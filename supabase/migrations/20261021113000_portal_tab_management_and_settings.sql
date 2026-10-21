-- =====================================================================
-- Migration: Portal Tab Management, Settings, and Codes Export
-- Data: 21/10/2026
-- =====================================================================

-- 1. Tabela de Configurações do Portal
CREATE TABLE IF NOT EXISTS public.portal_settings (
  team_id                 uuid PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  portal_enabled          boolean NOT NULL DEFAULT true,
  maintenance_message     text NOT NULL DEFAULT 'O Portal do Profissional está em manutenção técnica programada. Por favor, tente novamente em instantes.',
  global_announcement     text NOT NULL DEFAULT '',
  allow_leave_requests    boolean NOT NULL DEFAULT true,
  require_terms           boolean NOT NULL DEFAULT true,
  show_unit_schedules     boolean NOT NULL DEFAULT true,
  session_duration_days   integer NOT NULL DEFAULT 30,
  updated_at              timestamptz NOT NULL DEFAULT now(),
  updated_by              uuid REFERENCES auth.users(id)
);

ALTER TABLE public.portal_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'portal_settings' AND policyname = 'portal_settings_select_policy') THEN
    CREATE POLICY portal_settings_select_policy ON public.portal_settings
      FOR SELECT TO authenticated
      USING (team_id = public.user_team_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'portal_settings' AND policyname = 'portal_settings_update_policy') THEN
    CREATE POLICY portal_settings_update_policy ON public.portal_settings
      FOR ALL TO authenticated
      USING (team_id = public.user_team_id() AND public.user_is_any(ARRAY['admin', 'rh']))
      WITH CHECK (team_id = public.user_team_id() AND public.user_is_any(ARRAY['admin', 'rh']));
  END IF;
END $$;

INSERT INTO public.portal_settings (team_id)
SELECT id FROM public.teams
ON CONFLICT (team_id) DO NOTHING;

-- 2. Função de listagem dos códigos de acesso de 3 dígitos de todos os profissionais
CREATE OR REPLACE FUNCTION public.portal_admin_list_codes()
RETURNS TABLE (
  employee_id uuid,
  employee_name text,
  phone text,
  category_id uuid,
  category_name text,
  unit_id uuid,
  unit_name text,
  code text,
  last_access_at timestamptz,
  terms_accepted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid;
  v_team_id uuid;
  v_is_admin_rh boolean;
  v_manager_unit_id uuid;
  v_rec record;
  v_new_code text;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  v_team_id := public.user_team_id();
  IF v_team_id IS NULL THEN
    RETURN;
  END IF;

  v_is_admin_rh := public.user_is_any(ARRAY['admin', 'rh']);
  
  SELECT ur.unit_id INTO v_manager_unit_id 
  FROM public.user_roles ur
  WHERE ur.user_id = v_uid AND ur.role = 'unit_manager' 
  LIMIT 1;

  -- Garante que todo profissional ativo tenha um código de 3 dígitos gerado
  FOR v_rec IN 
    SELECT e.id 
    FROM public.employees e 
    LEFT JOIN public.employee_access_codes ac ON ac.employee_id = e.id 
    WHERE e.team_id = v_team_id AND e.active = true AND ac.code IS NULL
  LOOP
    v_new_code := public.portal_generate_unique_code_3();
    INSERT INTO public.employee_access_codes (employee_id, team_id, code)
    VALUES (v_rec.id, v_team_id, v_new_code)
    ON CONFLICT (employee_id) DO NOTHING;
  END LOOP;

  RETURN QUERY
  SELECT 
    e.id AS employee_id,
    e.name AS employee_name,
    e.phone,
    e.category_id,
    c.name AS category_name,
    e.unit_id,
    u.name AS unit_name,
    coalesce(ac.code, '---') AS code,
    e.last_access_at,
    e.terms_accepted_at
  FROM public.employees e
  LEFT JOIN public.employee_access_codes ac ON ac.employee_id = e.id
  LEFT JOIN public.categories c ON c.id = e.category_id
  LEFT JOIN public.units u ON u.id = e.unit_id
  WHERE e.team_id = v_team_id
    AND e.active = true
    AND (
      v_is_admin_rh 
      OR (v_manager_unit_id IS NOT NULL AND e.unit_id = v_manager_unit_id)
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = v_uid 
          AND ur.role = 'category_chief' 
          AND ur.category_id = e.category_id
      )
    )
  ORDER BY e.name ASC;
END;
$$;

-- 3. Obter configurações do Portal
CREATE OR REPLACE FUNCTION public.portal_admin_get_settings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_team_id uuid;
  v_settings record;
  v_active_sessions int;
  v_blocked_ips int;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  v_team_id := public.user_team_id();
  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Time não encontrado';
  END IF;

  SELECT * INTO v_settings FROM public.portal_settings WHERE team_id = v_team_id;
  IF NOT FOUND THEN
    INSERT INTO public.portal_settings (team_id) VALUES (v_team_id);
    SELECT * INTO v_settings FROM public.portal_settings WHERE team_id = v_team_id;
  END IF;

  SELECT count(*) INTO v_active_sessions FROM public.portal_sessions WHERE team_id = v_team_id AND expires_at > now();
  SELECT count(*) INTO v_blocked_ips FROM public.portal_ip_blocks WHERE blocked_until > now();

  RETURN jsonb_build_object(
    'team_id', v_settings.team_id,
    'portal_enabled', v_settings.portal_enabled,
    'maintenance_message', v_settings.maintenance_message,
    'global_announcement', v_settings.global_announcement,
    'allow_leave_requests', v_settings.allow_leave_requests,
    'require_terms', v_settings.require_terms,
    'show_unit_schedules', v_settings.show_unit_schedules,
    'session_duration_days', v_settings.session_duration_days,
    'updated_at', v_settings.updated_at,
    'active_sessions_count', v_active_sessions,
    'blocked_ips_count', v_blocked_ips
  );
END;
$$;

-- 4. Atualizar configurações do Portal
CREATE OR REPLACE FUNCTION public.portal_admin_update_settings(p_settings jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_team_id uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF NOT public.user_is_any(ARRAY['admin', 'rh']) THEN
    RAISE EXCEPTION 'Apenas Administradores e RH podem alterar configurações do Portal.';
  END IF;

  v_team_id := public.user_team_id();
  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Time não encontrado';
  END IF;

  INSERT INTO public.portal_settings (
    team_id,
    portal_enabled,
    maintenance_message,
    global_announcement,
    allow_leave_requests,
    require_terms,
    show_unit_schedules,
    session_duration_days,
    updated_at,
    updated_by
  )
  VALUES (
    v_team_id,
    coalesce((p_settings->>'portal_enabled')::boolean, true),
    coalesce(p_settings->>'maintenance_message', 'O Portal do Profissional está em manutenção técnica programada. Por favor, tente novamente em instantes.'),
    coalesce(p_settings->>'global_announcement', ''),
    coalesce((p_settings->>'allow_leave_requests')::boolean, true),
    coalesce((p_settings->>'require_terms')::boolean, true),
    coalesce((p_settings->>'show_unit_schedules')::boolean, true),
    coalesce((p_settings->>'session_duration_days')::integer, 30),
    now(),
    v_uid
  )
  ON CONFLICT (team_id) DO UPDATE SET
    portal_enabled        = coalesce((p_settings->>'portal_enabled')::boolean, portal_settings.portal_enabled),
    maintenance_message   = coalesce(p_settings->>'maintenance_message', portal_settings.maintenance_message),
    global_announcement   = coalesce(p_settings->>'global_announcement', portal_settings.global_announcement),
    allow_leave_requests  = coalesce((p_settings->>'allow_leave_requests')::boolean, portal_settings.allow_leave_requests),
    require_terms         = coalesce((p_settings->>'require_terms')::boolean, portal_settings.require_terms),
    show_unit_schedules   = coalesce((p_settings->>'show_unit_schedules')::boolean, portal_settings.show_unit_schedules),
    session_duration_days = coalesce((p_settings->>'session_duration_days')::integer, portal_settings.session_duration_days),
    updated_at            = now(),
    updated_by            = v_uid;

  RETURN public.portal_admin_get_settings();
END;
$$;

-- 5. Limpar bloqueios de IP (desbloqueio emergencial)
CREATE OR REPLACE FUNCTION public.portal_admin_clear_ip_blocks()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  IF NOT public.user_is_any(ARRAY['admin', 'rh']) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  DELETE FROM public.portal_ip_blocks;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  DELETE FROM public.portal_login_attempts;

  RETURN jsonb_build_object('ok', true, 'unblocked_count', v_deleted);
END;
$$;

-- 6. Encerrar todas as sessões ativas
CREATE OR REPLACE FUNCTION public.portal_admin_terminate_all_sessions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_team_id uuid;
  v_deleted int;
BEGIN
  IF NOT public.user_is_any(ARRAY['admin', 'rh']) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  v_team_id := public.user_team_id();

  DELETE FROM public.portal_sessions WHERE team_id = v_team_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RETURN jsonb_build_object('ok', true, 'terminated_sessions', v_deleted);
END;
$$;

-- Permissões
REVOKE ALL ON FUNCTION public.portal_admin_list_codes()             FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_admin_list_codes()           TO authenticated;

REVOKE ALL ON FUNCTION public.portal_admin_get_settings()           FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_admin_get_settings()         TO authenticated;

REVOKE ALL ON FUNCTION public.portal_admin_update_settings(jsonb)   FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_admin_update_settings(jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.portal_admin_clear_ip_blocks()        FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_admin_clear_ip_blocks()      TO authenticated;

REVOKE ALL ON FUNCTION public.portal_admin_terminate_all_sessions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.portal_admin_terminate_all_sessions() TO authenticated;
