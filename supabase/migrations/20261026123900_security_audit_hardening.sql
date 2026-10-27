-- ==============================================================================
-- Migration: 20261026123900_security_audit_hardening.sql
-- Description:
--   1. Restricts open public listing of invites & category invites (prevents token scraping)
--   2. Introduces secure RPCs get_invite_details and get_category_invite_details
--   3. Tightens multi-tenant RLS on professional_leave_requests
--   4. Configures file size and MIME-type constraints on storage bucket 'avatars'
--   5. Fixes mutable search_path on default-generating functions
--   6. Revokes unauthorized EXECUTE permissions on trigger-only functions
-- ==============================================================================

-- 1. Funções seguras de consulta de convites por token
CREATE OR REPLACE FUNCTION public.get_invite_details(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inv record;
  v_unit_name text := NULL;
  v_cat_name text := NULL;
BEGIN
  SELECT * INTO v_inv
  FROM public.invites
  WHERE token = p_token
    AND used = false
    AND (expires_at IS NULL OR expires_at > now());

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Convite inválido, expirado ou já utilizado.');
  END IF;

  IF v_inv.unit_id IS NOT NULL THEN
    SELECT name INTO v_unit_name FROM public.units WHERE id = v_inv.unit_id;
  END IF;

  IF v_inv.category_id IS NOT NULL THEN
    SELECT name INTO v_cat_name FROM public.categories WHERE id = v_inv.category_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'invite', jsonb_build_object(
      'id', v_inv.id,
      'token', v_inv.token,
      'role', v_inv.role,
      'team_id', v_inv.team_id,
      'unit_id', v_inv.unit_id,
      'unit_name', v_unit_name,
      'category_id', v_inv.category_id,
      'category_name', v_cat_name,
      'expires_at', v_inv.expires_at,
      'used', v_inv.used
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_details(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_category_invite_details(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_inv record;
BEGIN
  SELECT * INTO v_inv
  FROM public.category_invites
  WHERE token = p_token
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR uses_count < max_uses);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Convite de categoria inválido, expirado ou já esgotado.');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'invite', jsonb_build_object(
      'id', v_inv.id,
      'token', v_inv.token,
      'label', v_inv.label,
      'category_ids', v_inv.category_ids,
      'is_active', v_inv.is_active,
      'uses_count', v_inv.uses_count,
      'max_uses', v_inv.max_uses,
      'expires_at', v_inv.expires_at
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_category_invite_details(text) TO anon, authenticated;

-- 2. Restringir RLS em public.invites
DROP POLICY IF EXISTS "Anon can read unused invites" ON public.invites;
DROP POLICY IF EXISTS "Authenticated can read invites by token" ON public.invites;
DROP POLICY IF EXISTS "Authenticated can read invite by token" ON public.invites;

DROP POLICY IF EXISTS "Admins can select invites" ON public.invites;
CREATE POLICY "Admins can select invites"
ON public.invites
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (SELECT auth.uid()) AND ur.role = 'admin'
  )
);

-- 3. Restringir RLS em public.category_invites
DROP POLICY IF EXISTS "Authenticated can read active invites" ON public.category_invites;

DROP POLICY IF EXISTS "Admins can select category invites" ON public.category_invites;
CREATE POLICY "Admins can select category invites"
ON public.category_invites
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = (SELECT auth.uid()) AND ur.role = 'admin'
  )
);

-- 4. Corrigir multi-tenancy em public.professional_leave_requests
DROP POLICY IF EXISTS "Team members can read prof_leave_requests" ON public.professional_leave_requests;
CREATE POLICY "Team members can read prof_leave_requests"
ON public.professional_leave_requests
FOR SELECT
TO authenticated
USING (
  team_id = (SELECT public.user_team_id())
);

-- 5. Endurecimento do Storage Bucket 'avatars'
UPDATE storage.buckets
SET 
  file_size_limit = 2097152, -- 2 MB
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'avatars';

-- 6. Corrigir mutable search_path em funções de defaults
ALTER FUNCTION public.fn_schedules_set_defaults() SET search_path = public;
ALTER FUNCTION public.fn_leave_requests_set_defaults() SET search_path = public;

-- 7. Revogação de EXECUTE público em funções de trigger/internas
DO $$
BEGIN
  REVOKE EXECUTE ON FUNCTION public.fn_schedules_set_defaults() FROM anon, public;
  REVOKE EXECUTE ON FUNCTION public.fn_leave_requests_set_defaults() FROM anon, public;
  REVOKE EXECUTE ON FUNCTION public.fn_notify_credit_added() FROM anon, public;
  REVOKE EXECUTE ON FUNCTION public.fn_notify_new_leave_request() FROM anon, public;
  REVOKE EXECUTE ON FUNCTION public.fn_notify_schedule_created() FROM anon, public;
  REVOKE EXECUTE ON FUNCTION public.fn_notify_schedule_deleted() FROM anon, public;
  REVOKE EXECUTE ON FUNCTION public.fn_notify_transfer_created() FROM anon, public;
  REVOKE EXECUTE ON FUNCTION public.fn_on_employee_deactivated() FROM anon, public;
  REVOKE EXECUTE ON FUNCTION public.on_extra_schedule_calculate() FROM anon, public;
  REVOKE EXECUTE ON FUNCTION public.on_extra_schedule_insert() FROM anon, public;
  REVOKE EXECUTE ON FUNCTION public.on_leave_approved() FROM anon, public;
  REVOKE EXECUTE ON FUNCTION public.on_leave_deleted() FROM anon, public;
  REVOKE EXECUTE ON FUNCTION public.on_leave_status_change() FROM anon, public;
  REVOKE EXECUTE ON FUNCTION public.on_schedule_delete() FROM anon, public;
  REVOKE EXECUTE ON FUNCTION public.notify_leave_update() FROM anon, public;
  REVOKE EXECUTE ON FUNCTION public.check_leave_request_conflicts() FROM anon, public;
  REVOKE EXECUTE ON FUNCTION public.check_schedule_leave_conflicts() FROM anon, public;
  REVOKE EXECUTE ON FUNCTION public.validate_credit_adjustment() FROM anon, public;
  REVOKE EXECUTE ON FUNCTION public.process_audit_log() FROM anon, public;
  REVOKE EXECUTE ON FUNCTION public.prevent_last_admin_role_change() FROM anon, public;
  REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public;
  REVOKE EXECUTE ON FUNCTION public.trigger_send_push() FROM anon, public;
  REVOKE EXECUTE ON FUNCTION public.grant_pending_extra_credits() FROM anon, public;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Alguma revogação falhou: %', SQLERRM;
END;
$$;
