-- =====================================================================
-- Migration: Portal - Código de Acesso de 3 Dígitos e Hardening de Segurança
-- Data: 18/10/2026
-- =====================================================================

-- 1. Atualizar a constraint de código para 3 dígitos numéricos
ALTER TABLE public.employee_access_codes
  DROP CONSTRAINT IF EXISTS employee_access_codes_code_check;

ALTER TABLE public.employee_access_codes
  ADD CONSTRAINT employee_access_codes_code_check CHECK (code ~ '^[0-9]{3}$');

-- 2. Tabela de Bloqueios Temporários por IP (Lockout Server-side)
CREATE TABLE IF NOT EXISTS public.portal_ip_blocks (
  ip_hash       text PRIMARY KEY,
  blocked_until timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portal_blocks_until ON public.portal_ip_blocks(blocked_until);
ALTER TABLE public.portal_ip_blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portal_ip_blocks FROM anon, authenticated;

-- 3. Função geradora de código de 3 dígitos (000 a 999)
-- Garante que cada profissional ativo possua um código único de 3 dígitos
CREATE OR REPLACE FUNCTION public.portal_generate_unique_code_3()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_code text;
  v_cand int;
  v_try  int := 0;
BEGIN
  -- Tenta sorteio criptográfico primeiro
  LOOP
    v_cand := (('x' || encode(gen_random_bytes(2), 'hex'))::bit(16)::int) % 1000;
    v_code := lpad(v_cand::text, 3, '0');
    
    IF NOT EXISTS (SELECT 1 FROM public.employee_access_codes WHERE code = v_code) THEN
      RETURN v_code;
    END IF;

    v_try := v_try + 1;
    EXIT WHEN v_try > 200;
  END LOOP;

  -- Se após 200 tentativas houver colisão (espaço preenchendo), pega o primeiro livre entre 000 e 999
  SELECT lpad(s.n::text, 3, '0') INTO v_code
  FROM generate_series(0, 999) AS s(n)
  LEFT JOIN public.employee_access_codes c ON c.code = lpad(s.n::text, 3, '0')
  WHERE c.code IS NULL
  ORDER BY random()
  LIMIT 1;

  IF v_code IS NULL THEN
    RAISE EXCEPTION 'Capacidade máxima de códigos de 3 dígitos (1000) atingida.';
  END IF;

  RETURN v_code;
END;
$$;

-- 4. Função atualizada de login com PIN de 3 dígitos e Salvaguardas Rigorosas
-- - Limite de 3 tentativas erradas a cada 15 minutos por IP
-- - Bloqueio temporário (lockout) automático de 15 minutos gravado em portal_ip_blocks
-- - Limite global de tentativas erradas (150 falhas no sistema inteiro em 10 min)
-- - Atraso de 350ms em tentativas com falha para retardar ataques automatizados
CREATE OR REPLACE FUNCTION public.portal_login(p_code text, p_user_agent text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_code         text;
  v_headers      jsonb;
  v_ip           text;
  v_ip_hash      text;
  v_fail_ip      int;
  v_fail_global  int;
  v_blocked_time timestamptz;
  v_emp          record;
  v_token        text;
BEGIN
  v_code := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');

  -- IP do cliente via cabeçalho do PostgREST / Supabase
  BEGIN
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_headers := NULL;
  END;
  v_ip := coalesce(
    nullif(trim(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1)), ''),
    'unknown'
  );
  v_ip_hash := encode(digest(v_ip, 'sha256'), 'hex');

  -- Higiene rotineira
  DELETE FROM public.portal_login_attempts WHERE attempted_at < now() - interval '1 day';
  DELETE FROM public.portal_ip_blocks WHERE blocked_until < now();

  -- 1. Verifica se o IP está ativamente bloqueado
  SELECT blocked_until INTO v_blocked_time
  FROM public.portal_ip_blocks
  WHERE ip_hash = v_ip_hash AND blocked_until > now();

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'rate_limited',
      'retry_after_minutes', ceil(extract(epoch from (v_blocked_time - now())) / 60)
    );
  END IF;

  -- 2. Limite por IP: 3 falhas nos últimos 15 min | Limite Global: 150 falhas em 10 min
  SELECT count(*) INTO v_fail_ip
  FROM public.portal_login_attempts
  WHERE ip_hash = v_ip_hash AND attempted_at > now() - interval '15 minutes';

  SELECT count(*) INTO v_fail_global
  FROM public.portal_login_attempts
  WHERE attempted_at > now() - interval '10 minutes';

  IF v_fail_ip >= 3 OR v_fail_global >= 150 THEN
    -- Aplica bloqueio preventivo de 15 minutos
    INSERT INTO public.portal_ip_blocks (ip_hash, blocked_until)
    VALUES (v_ip_hash, now() + interval '15 minutes')
    ON CONFLICT (ip_hash) DO UPDATE SET blocked_until = EXCLUDED.blocked_until;

    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'rate_limited',
      'retry_after_minutes', 15
    );
  END IF;

  -- 3. Validação do tamanho do código (3 dígitos)
  IF length(v_code) <> 3 THEN
    INSERT INTO public.portal_login_attempts (ip_hash) VALUES (v_ip_hash);
    PERFORM pg_sleep(0.35); -- atraso contra força bruta
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  -- 4. Busca o profissional associado ao código
  SELECT e.id, e.team_id, e.name, e.avatar_url, e.terms_version
    INTO v_emp
  FROM public.employee_access_codes c
  JOIN public.employees e ON e.id = c.employee_id AND e.active = true
  WHERE c.code = v_code;

  IF NOT FOUND THEN
    INSERT INTO public.portal_login_attempts (ip_hash) VALUES (v_ip_hash);
    PERFORM pg_sleep(0.35); -- atraso contra força bruta
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  -- SUCESSO: limpa tentativas e blocos do IP
  DELETE FROM public.portal_login_attempts WHERE ip_hash = v_ip_hash;
  DELETE FROM public.portal_ip_blocks WHERE ip_hash = v_ip_hash;

  -- Gera token de sessão seguro (256 bits)
  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.portal_sessions (employee_id, team_id, token_hash, user_agent)
  VALUES (
    v_emp.id,
    v_emp.team_id,
    encode(digest(v_token, 'sha256'), 'hex'),
    left(p_user_agent, 300)
  );

  UPDATE public.employees SET last_access_at = now() WHERE id = v_emp.id;
  DELETE FROM public.portal_sessions WHERE employee_id = v_emp.id AND expires_at < now();

  RETURN jsonb_build_object(
    'ok', true,
    'token', v_token,
    'employee', jsonb_build_object(
      'id', v_emp.id,
      'name', v_emp.name,
      'avatar_url', v_emp.avatar_url,
      'needs_terms', (v_emp.terms_version IS NULL OR v_emp.terms_version <> '1.0')
    )
  );
END;
$$;

-- 5. Atualiza função de regerar código no admin para 3 dígitos
CREATE OR REPLACE FUNCTION public.portal_admin_regenerate_code(p_employee_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_new_code text;
  v_team     uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: requer autenticação de gestor.';
  END IF;

  SELECT team_id INTO v_team FROM public.employees WHERE id = p_employee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profissional não encontrado.';
  END IF;

  v_new_code := public.portal_generate_unique_code_3();

  INSERT INTO public.employee_access_codes (employee_id, team_id, code, regenerated_at)
  VALUES (p_employee_id, v_team, v_new_code, now())
  ON CONFLICT (employee_id) DO UPDATE
    SET code = EXCLUDED.code,
        regenerated_at = now();

  -- Invalida sessões ativas anteriores por segurança
  DELETE FROM public.portal_sessions WHERE employee_id = p_employee_id;

  RETURN v_new_code;
END;
$$;

-- 6. Atualiza o trigger para novos funcionários usarem o novo gerador de 3 dígitos
CREATE OR REPLACE FUNCTION public.portal_create_code_for_new_employee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.employee_access_codes (employee_id, team_id, code)
  VALUES (NEW.id, NEW.team_id, public.portal_generate_unique_code_3())
  ON CONFLICT (employee_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 7. Migração dos Códigos Existentes para 3 Dígitos
-- Gera códigos de 3 dígitos únicos para todos os profissionais existentes
DO $$
DECLARE
  r record;
  v_cand text;
BEGIN
  -- Limpa temporariamente a tabela para reatribuir de forma limpa e sem conflitos
  -- As sessões ativas serão renovadas no primeiro login do profissional
  TRUNCATE TABLE public.employee_access_codes;

  FOR r IN
    SELECT id, team_id FROM public.employees ORDER BY created_at ASC
  LOOP
    v_cand := public.portal_generate_unique_code_3();
    INSERT INTO public.employee_access_codes (employee_id, team_id, code)
    VALUES (r.id, r.team_id, v_cand);
  END LOOP;
END $$;
