-- =====================================================================
-- PORTAL DO PROFISSIONAL — PASSO 1: BANCO DE DADOS E SEGURANÇA
--
-- Modelo de segurança:
--  * O profissional NÃO usa Supabase Auth. Ele entra com um código
--    pessoal de 6 dígitos e recebe um token de sessão aleatório.
--  * Nenhuma tabela é exposta ao papel `anon`. Todo acesso do portal
--    passa por funções SECURITY DEFINER que validam o token de sessão.
--  * Tabelas novas têm RLS ligado SEM políticas (negam tudo por padrão);
--    apenas as funções (owner) leem/escrevem.
--  * Tentativas erradas são limitadas por IP e globalmente (anti brute-force).
--  * Aceite de termos (LGPD) fica registrado em tabela de evidência.
--  * Consultas de dados do servidor (escalas, folgas, créditos, saldo)
--    e upload de avatar são blindados com token de sessão.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Colunas novas em employees
-- ---------------------------------------------------------------------
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS avatar_url        text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version     text,
  ADD COLUMN IF NOT EXISTS last_access_at    timestamptz;

-- ---------------------------------------------------------------------
-- 2. Tabelas do portal (RLS ligado, sem políticas = acesso só via RPC)
-- ---------------------------------------------------------------------

-- Código pessoal (guardado em claro pois o RH precisa enviá-lo ao servidor)
CREATE TABLE IF NOT EXISTS public.employee_access_codes (
  employee_id    uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  team_id        uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  code           text NOT NULL UNIQUE CHECK (code ~ '^[0-9]{6}$'),
  created_at     timestamptz NOT NULL DEFAULT now(),
  regenerated_at timestamptz
);
ALTER TABLE public.employee_access_codes ENABLE ROW LEVEL SECURITY;

-- Sessões do portal (somente o hash do token é guardado)
CREATE TABLE IF NOT EXISTS public.portal_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  team_id      uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  user_agent   text
);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_employee ON public.portal_sessions(employee_id);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_expires  ON public.portal_sessions(expires_at);
ALTER TABLE public.portal_sessions ENABLE ROW LEVEL SECURITY;

-- Tentativas de login (controle anti brute-force; IP guardado só como hash)
CREATE TABLE IF NOT EXISTS public.portal_login_attempts (
  id           bigserial PRIMARY KEY,
  ip_hash      text NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_portal_attempts_ip   ON public.portal_login_attempts(ip_hash, attempted_at);
CREATE INDEX IF NOT EXISTS idx_portal_attempts_time ON public.portal_login_attempts(attempted_at);
ALTER TABLE public.portal_login_attempts ENABLE ROW LEVEL SECURITY;

-- Evidência jurídica do aceite dos Termos de Uso e Privacidade (LGPD)
CREATE TABLE IF NOT EXISTS public.portal_terms_acceptances (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  team_id       uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  photo_consent boolean NOT NULL DEFAULT false,
  accepted_at   timestamptz NOT NULL DEFAULT now(),
  ip_address    text,
  user_agent    text
);
CREATE INDEX IF NOT EXISTS idx_portal_terms_employee ON public.portal_terms_acceptances(employee_id);
ALTER TABLE public.portal_terms_acceptances ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 3. Funções internas (nunca expostas a anon/authenticated)
-- ---------------------------------------------------------------------

-- Versão vigente dos termos
CREATE OR REPLACE FUNCTION public.portal_current_terms_version()
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$ SELECT 'v1.0'::text $$;

-- Gera código de 6 dígitos aleatório (criptográfico), único e não trivial
CREATE OR REPLACE FUNCTION public.portal_generate_unique_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_code text;
BEGIN
  LOOP
    v_code := lpad(
      ((('x' || encode(gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text,
      6, '0'
    );
    -- rejeita códigos triviais (000000, 111111, 123456, 654321...)
    CONTINUE WHEN v_code ~ '^(\d)\1{5}$'
               OR v_code IN ('123456', '654321', '012345', '543210');
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.employee_access_codes WHERE code = v_code);
    RETURN v_code;
  END LOOP;
END;
$$;

-- Valida token de sessão e devolve o employee_id (NULL se inválido/expirado)
CREATE OR REPLACE FUNCTION public.portal_session_employee(p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_emp uuid;
BEGIN
  IF p_token IS NULL OR length(p_token) < 32 THEN
    RETURN NULL;
  END IF;

  SELECT s.employee_id INTO v_emp
  FROM public.portal_sessions s
  JOIN public.employees e ON e.id = s.employee_id AND e.active = true
  WHERE s.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    AND s.expires_at > now();

  RETURN v_emp;
END;
$$;

-- Cria código automaticamente para todo profissional novo
CREATE OR REPLACE FUNCTION public.portal_create_code_for_new_employee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  INSERT INTO public.employee_access_codes (employee_id, team_id, code)
  VALUES (NEW.id, NEW.team_id, public.portal_generate_unique_code())
  ON CONFLICT (employee_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_portal_create_code ON public.employees;
CREATE TRIGGER trg_portal_create_code
  AFTER INSERT ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.portal_create_code_for_new_employee();

-- Backfill: código para quem já existe
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT e.id, e.team_id FROM public.employees e
    WHERE NOT EXISTS (SELECT 1 FROM public.employee_access_codes c WHERE c.employee_id = e.id)
  LOOP
    INSERT INTO public.employee_access_codes (employee_id, team_id, code)
    VALUES (r.id, r.team_id, public.portal_generate_unique_code());
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 4. RPCs públicas do portal (anon) — login, sessão, termos, dados, avatar
-- ---------------------------------------------------------------------

-- LOGIN: valida código, aplica limite de tentativas e abre sessão
CREATE OR REPLACE FUNCTION public.portal_login(p_code text, p_user_agent text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_code        text;
  v_headers     jsonb;
  v_ip          text;
  v_ip_hash     text;
  v_fail_ip     int;
  v_fail_global int;
  v_emp         record;
  v_token       text;
BEGIN
  v_code := regexp_replace(coalesce(p_code, ''), '\D', '', 'g');

  -- IP de origem (PostgREST repassa os headers) — guardado apenas como hash
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

  -- Higiene: apaga tentativas com mais de 1 dia
  DELETE FROM public.portal_login_attempts WHERE attempted_at < now() - interval '1 day';

  -- Limite por IP: 5 erros em 15 min | Limite global: 300 erros em 10 min
  SELECT count(*) INTO v_fail_ip
  FROM public.portal_login_attempts
  WHERE ip_hash = v_ip_hash AND attempted_at > now() - interval '15 minutes';

  SELECT count(*) INTO v_fail_global
  FROM public.portal_login_attempts
  WHERE attempted_at > now() - interval '10 minutes';

  IF v_fail_ip >= 5 OR v_fail_global >= 300 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'rate_limited', 'retry_after_minutes', 15);
  END IF;

  IF length(v_code) <> 6 THEN
    INSERT INTO public.portal_login_attempts (ip_hash) VALUES (v_ip_hash);
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  SELECT e.id, e.team_id, e.name, e.avatar_url, e.terms_version
    INTO v_emp
  FROM public.employee_access_codes c
  JOIN public.employees e ON e.id = c.employee_id AND e.active = true
  WHERE c.code = v_code;

  IF NOT FOUND THEN
    INSERT INTO public.portal_login_attempts (ip_hash) VALUES (v_ip_hash);
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_code');
  END IF;

  -- Sucesso: zera falhas do IP e abre sessão
  DELETE FROM public.portal_login_attempts WHERE ip_hash = v_ip_hash;

  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.portal_sessions (employee_id, team_id, token_hash, user_agent)
  VALUES (v_emp.id, v_emp.team_id, encode(digest(v_token, 'sha256'), 'hex'), left(p_user_agent, 300));

  UPDATE public.employees SET last_access_at = now() WHERE id = v_emp.id;

  -- Higiene: remove sessões expiradas deste profissional
  DELETE FROM public.portal_sessions WHERE employee_id = v_emp.id AND expires_at < now();

  RETURN jsonb_build_object(
    'ok', true,
    'token', v_token,
    'needs_terms', v_emp.terms_version IS DISTINCT FROM public.portal_current_terms_version(),
    'terms_version', public.portal_current_terms_version(),
    'employee', jsonb_build_object(
      'id', v_emp.id,
      'name', v_emp.name,
      'avatar_url', v_emp.avatar_url
    )
  );
END;
$$;

-- PERFIL: dados básicos do profissional logado
CREATE OR REPLACE FUNCTION public.portal_me(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_emp_id uuid;
  v_result jsonb;
BEGIN
  v_emp_id := public.portal_session_employee(p_token);
  IF v_emp_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_session');
  END IF;

  -- Escrita de last_seen no máximo a cada 5 min
  UPDATE public.portal_sessions
     SET last_seen_at = now()
   WHERE token_hash = encode(digest(p_token, 'sha256'), 'hex')
     AND last_seen_at < now() - interval '5 minutes';

  SELECT jsonb_build_object(
    'ok', true,
    'needs_terms', e.terms_version IS DISTINCT FROM public.portal_current_terms_version(),
    'terms_version', public.portal_current_terms_version(),
    'employee', jsonb_build_object(
      'id', e.id,
      'name', e.name,
      'avatar_url', e.avatar_url,
      'category_name', c.name,
      'unit_name', u.name,
      'terms_accepted_at', e.terms_accepted_at
    )
  )
  INTO v_result
  FROM public.employees e
  LEFT JOIN public.categories c ON c.id = e.category_id
  LEFT JOIN public.units u ON u.id = e.unit_id
  WHERE e.id = v_emp_id;

  RETURN v_result;
END;
$$;

-- DADOS COMPLETOS DO PORTAL (escalas, pedidos de folga, créditos e saldo calculado)
CREATE OR REPLACE FUNCTION public.portal_get_dashboard_data(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_emp_id      uuid;
  v_profile     jsonb;
  v_schedules   jsonb;
  v_leaves      jsonb;
  v_credits     jsonb;
  v_shifts      numeric;
  v_manual      numeric;
  v_used        numeric;
  v_balance     numeric;
BEGIN
  v_emp_id := public.portal_session_employee(p_token);
  IF v_emp_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_session');
  END IF;

  -- Perfil
  SELECT jsonb_build_object(
    'id', e.id,
    'name', e.name,
    'avatar_url', e.avatar_url,
    'category_name', coalesce(c.name, '—'),
    'unit_name', coalesce(u.name, '—'),
    'terms_accepted_at', e.terms_accepted_at,
    'needs_terms', e.terms_version IS DISTINCT FROM public.portal_current_terms_version()
  )
  INTO v_profile
  FROM public.employees e
  LEFT JOIN public.categories c ON c.id = e.category_id
  LEFT JOIN public.units u ON u.id = e.unit_id
  WHERE e.id = v_emp_id;

  -- Escalas recentes e futuras (ordenadas decrescente por data)
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'date', s.date,
      'type', s.type,
      'shift_type', s.shift_type,
      'unit_name', coalesce(u.name, '—'),
      'observations', s.observations,
      'credit_amount', s.credit_amount
    ) ORDER BY s.date DESC
  ), '[]'::jsonb)
  INTO v_schedules
  FROM public.schedules s
  LEFT JOIN public.units u ON u.id = s.unit_id
  WHERE s.employee_id = v_emp_id;

  -- Pedidos de folga com foco em pedidos pendentes e histórico
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', l.id,
      'status', l.status,
      'days_requested', l.days_requested,
      'leave_dates', l.leave_dates,
      'observations', l.observations,
      'created_at', l.created_at,
      'decided_at', l.decided_at
    ) ORDER BY l.created_at DESC
  ), '[]'::jsonb)
  INTO v_leaves
  FROM public.leave_requests l
  WHERE l.employee_id = v_emp_id;

  -- Créditos detalhados
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'id', lc.id,
      'amount', lc.amount,
      'origin', lc.origin,
      'notes', lc.notes,
      'created_at', lc.created_at
    ) ORDER BY lc.created_at DESC
  ), '[]'::jsonb)
  INTO v_credits
  FROM public.leave_credits lc
  WHERE lc.employee_id = v_emp_id;

  -- Totais e Saldo
  SELECT
    coalesce(sum(CASE WHEN origin = 'extra_shift' THEN amount ELSE 0 END), 0),
    coalesce(sum(CASE WHEN origin NOT IN ('extra_shift', 'leave_used') THEN amount ELSE 0 END), 0),
    abs(coalesce(sum(CASE WHEN origin = 'leave_used' THEN amount ELSE 0 END), 0)),
    coalesce(sum(amount), 0)
  INTO v_shifts, v_manual, v_used, v_balance
  FROM public.leave_credits
  WHERE employee_id = v_emp_id;

  RETURN jsonb_build_object(
    'ok', true,
    'profile', v_profile,
    'summary', jsonb_build_object(
      'shifts', v_shifts,
      'manual', v_manual,
      'used', v_used,
      'balance', v_balance
    ),
    'schedules', v_schedules,
    'leaves', v_leaves,
    'credits', v_credits
  );
END;
$$;

-- ATUALIZAR FOTO DE PERFIL (AVATAR) DO PROFISSIONAL
CREATE OR REPLACE FUNCTION public.portal_update_avatar(p_token text, p_avatar_url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_emp_id uuid;
  v_url    text;
BEGIN
  v_emp_id := public.portal_session_employee(p_token);
  IF v_emp_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_session');
  END IF;

  v_url := nullif(trim(p_avatar_url), '');
  IF v_url IS NOT NULL AND length(v_url) > 1000 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_url');
  END IF;

  UPDATE public.employees
     SET avatar_url = v_url,
         updated_at = now()
   WHERE id = v_emp_id;

  RETURN jsonb_build_object('ok', true, 'avatar_url', v_url);
END;
$$;

-- TERMOS (LGPD): registra o aceite com data/hora, versão, IP e dispositivo
CREATE OR REPLACE FUNCTION public.portal_accept_terms(
  p_token text,
  p_photo_consent boolean DEFAULT false,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_emp_id  uuid;
  v_team_id uuid;
  v_headers jsonb;
  v_ip      text;
BEGIN
  v_emp_id := public.portal_session_employee(p_token);
  IF v_emp_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_session');
  END IF;

  SELECT team_id INTO v_team_id FROM public.employees WHERE id = v_emp_id;

  BEGIN
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_headers := NULL;
  END;
  v_ip := nullif(trim(split_part(coalesce(v_headers->>'x-forwarded-for', ''), ',', 1)), '');

  INSERT INTO public.portal_terms_acceptances
    (employee_id, team_id, terms_version, photo_consent, ip_address, user_agent)
  VALUES
    (v_emp_id, v_team_id, public.portal_current_terms_version(),
     coalesce(p_photo_consent, false), v_ip, left(p_user_agent, 300));

  UPDATE public.employees
     SET terms_accepted_at = now(),
         terms_version = public.portal_current_terms_version()
   WHERE id = v_emp_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- LOGOUT: encerra a sessão atual
CREATE OR REPLACE FUNCTION public.portal_logout(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  DELETE FROM public.portal_sessions
   WHERE token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ---------------------------------------------------------------------
-- 5. RPCs administrativas (apenas usuários logados com permissão)
-- ---------------------------------------------------------------------

-- Permissão: admin/rh da mesma equipe ou gestor da unidade do profissional
CREATE OR REPLACE FUNCTION public.portal_admin_can_manage(p_employee_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid;
  v_emp  record;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT team_id, unit_id INTO v_emp FROM public.employees WHERE id = p_employee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profissional não encontrado';
  END IF;

  IF v_emp.team_id IS DISTINCT FROM (SELECT public.user_team_id()) THEN
    RETURN false;
  END IF;

  RETURN public.user_is_any(ARRAY['admin', 'rh'])
      OR EXISTS (
           SELECT 1 FROM public.user_roles ur
           WHERE ur.user_id = (SELECT auth.uid())
             AND ur.role = 'unit_manager'
             AND ur.unit_id = v_emp.unit_id
         );
END;
$$;

-- Consultar o código do profissional (para enviar por WhatsApp)
CREATE OR REPLACE FUNCTION public.portal_admin_get_code(p_employee_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF NOT public.portal_admin_can_manage(p_employee_id) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT code INTO v_code FROM public.employee_access_codes WHERE employee_id = p_employee_id;
  RETURN v_code;
END;
$$;

-- Regerar código (encerra todas as sessões abertas do profissional)
CREATE OR REPLACE FUNCTION public.portal_admin_regenerate_code(p_employee_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_code    text;
  v_team_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;
  IF NOT public.portal_admin_can_manage(p_employee_id) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT team_id INTO v_team_id FROM public.employees WHERE id = p_employee_id;
  v_code := public.portal_generate_unique_code();

  INSERT INTO public.employee_access_codes (employee_id, team_id, code, regenerated_at)
  VALUES (p_employee_id, v_team_id, v_code, now())
  ON CONFLICT (employee_id)
  DO UPDATE SET code = EXCLUDED.code, regenerated_at = now();

  DELETE FROM public.portal_sessions WHERE employee_id = p_employee_id;

  RETURN v_code;
END;
$$;

-- ---------------------------------------------------------------------
-- 6. Bucket de armazenamento para avatares públicos
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de Storage para upload de avatar do portal
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public can view avatars" ON storage.objects;
CREATE POLICY "Public can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Allow portal avatar uploads" ON storage.objects;
CREATE POLICY "Allow portal avatar uploads"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'portal'
  );

DROP POLICY IF EXISTS "Allow portal avatar updates" ON storage.objects;
CREATE POLICY "Allow portal avatar updates"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'portal'
  );

-- ---------------------------------------------------------------------
-- 7. Permissões de execução (princípio do menor privilégio)
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.portal_current_terms_version()            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.portal_generate_unique_code()             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.portal_session_employee(text)             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.portal_create_code_for_new_employee()     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.portal_admin_can_manage(uuid)             FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.portal_login(text, text)                  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.portal_me(text)                           FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.portal_get_dashboard_data(text)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.portal_update_avatar(text, text)          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.portal_accept_terms(text, boolean, text)  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.portal_logout(text)                       FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.portal_login(text, text)                 TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_me(text)                          TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_get_dashboard_data(text)         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_update_avatar(text, text)         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_accept_terms(text, boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_logout(text)                      TO anon, authenticated;

REVOKE ALL ON FUNCTION public.portal_admin_get_code(uuid)         FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.portal_admin_regenerate_code(uuid)  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_admin_get_code(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.portal_admin_regenerate_code(uuid) TO authenticated;

-- Tabelas do portal: nenhum acesso direto para anon/authenticated
REVOKE ALL ON public.employee_access_codes    FROM anon, authenticated;
REVOKE ALL ON public.portal_sessions          FROM anon, authenticated;
REVOKE ALL ON public.portal_login_attempts    FROM anon, authenticated;
REVOKE ALL ON public.portal_terms_acceptances FROM anon, authenticated;
