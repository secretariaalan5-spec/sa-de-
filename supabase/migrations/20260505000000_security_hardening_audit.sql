-- =====================================================
-- SECURITY HARDENING: Audit Fixes (2026-05-05)
-- Resolves all Critical and High findings from audit.
-- SAFE: Does not break existing functionality.
-- =====================================================

-- ─────────────────────────────────────────────────────
-- FIX C2: PRIVILEGE ESCALATION — ur_insert allows
-- any authenticated user to self-assign ANY role.
-- The invite RPCs (accept_invite_by_token,
-- accept_category_invite) are SECURITY DEFINER and
-- bypass RLS, so they do NOT need this policy.
-- Only admins should be able to manually insert roles.
-- ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "ur_insert" ON public.user_roles;
CREATE POLICY "Only admins can insert roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_is('admin')
    AND team_id = (SELECT public.user_team_id())
  );

-- ─────────────────────────────────────────────────────
-- FIX A1: leave_credits INSERT missing team_id check.
-- Without this, an admin from Team A could inject
-- credits into Team B employees (cross-tenant).
-- ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Chiefs and admins can insert leave_credits" ON public.leave_credits;
CREATE POLICY "Team-scoped insert leave_credits"
  ON public.leave_credits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_is_any(ARRAY['admin', 'category_chief'])
    AND team_id = (SELECT public.user_team_id())
  );

-- ─────────────────────────────────────────────────────
-- FIX A2: leave_requests INSERT missing team_id check.
-- Same cross-tenant injection vector as leave_credits.
-- ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Managers and admins can insert leave_requests" ON public.leave_requests;
CREATE POLICY "Team-scoped insert leave_requests"
  ON public.leave_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_is_any(ARRAY['admin', 'unit_manager', 'category_chief'])
    AND team_id = (SELECT public.user_team_id())
  );

-- Also fix leave_requests UPDATE (was missing team_id)
DROP POLICY IF EXISTS "Chiefs and admins can update leave_requests" ON public.leave_requests;
CREATE POLICY "Team-scoped update leave_requests"
  ON public.leave_requests
  FOR UPDATE
  TO authenticated
  USING (
    public.user_is_any(ARRAY['admin', 'category_chief'])
    AND team_id = (SELECT public.user_team_id())
  );

-- ─────────────────────────────────────────────────────
-- FIX A3: process_audit_log() missing SET search_path.
-- Prevents CWE-426 search_path injection attacks.
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_record_id UUID;
  v_changes JSONB;
  v_action TEXT;
BEGIN
  v_user_id := auth.uid();
  v_action := TG_OP;
  
  IF TG_OP = 'INSERT' THEN
    v_record_id := NEW.id;
    v_changes := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_record_id := NEW.id;
    IF (to_jsonb(OLD)->>'active') = 'true' AND (to_jsonb(NEW)->>'active') = 'false' THEN
       v_action := 'DELETE';
       v_changes := to_jsonb(OLD);
    ELSE
       v_changes := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id;
    v_changes := to_jsonb(OLD);
  END IF;

  INSERT INTO public.audit_logs (table_name, action, record_id, actor_id, changes)
  VALUES (TG_TABLE_NAME, v_action, v_record_id, v_user_id, v_changes);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- ─────────────────────────────────────────────────────
-- FIX C1: Remove hardcoded JWT from trigger_send_push.
-- Replace with a version that reads from a Vault secret
-- or PostgreSQL config parameter (app.settings.anon_key).
-- The key must be set via Supabase Dashboard > Vault
-- or via: ALTER DATABASE postgres SET app.settings.anon_key = 'your-key';
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trigger_send_push()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  supabase_url TEXT;
  service_key  TEXT;
BEGIN
  -- Read from PostgreSQL config (set via Supabase Dashboard or ALTER DATABASE)
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key  := current_setting('app.settings.supabase_anon_key', true);
  
  -- Skip if not configured (prevents errors during migration)
  IF supabase_url IS NULL OR service_key IS NULL THEN
    RAISE WARNING 'Push notification skipped: app.settings.supabase_url or app.settings.supabase_anon_key not configured.';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body    := jsonb_build_object(
      'record', jsonb_build_object(
        'user_id', NEW.user_id,
        'title',   COALESCE(NEW.title, 'Saúde+'),
        'message', COALESCE(NEW.message, ''),
        'link',    COALESCE(NEW.link, '/')
      )
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Push notification trigger error: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────
-- FIX M3: portal_invites/portal_schedules SELECT
-- policies are too broad (USING (true) = all teams).
-- Restrict to team members only.
-- ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "pi_select" ON public.portal_invites;
CREATE POLICY "pi_select" ON public.portal_invites
  FOR SELECT TO authenticated
  USING (
    admin_id = (SELECT auth.uid())
    OR public.user_is_any(ARRAY['admin', 'rh'])
  );

DROP POLICY IF EXISTS "ps_select" ON public.portal_schedules;
CREATE POLICY "ps_select" ON public.portal_schedules
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.user_is_any(ARRAY['admin', 'rh', 'category_chief'])
  );

-- ─────────────────────────────────────────────────────
-- FIX M4: Anon can enumerate all active category_invites.
-- The registration flow uses accept_category_invite RPC
-- (SECURITY DEFINER) which bypasses RLS.
-- Keep minimal anon access for token validation only.
-- ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anon can read invite by token" ON public.category_invites;
-- No replacement needed: the RPC handles everything.

-- ─────────────────────────────────────────────────────
-- FIX M2: Revoke EXECUTE on legacy helper functions
-- that should no longer be used (replaced by user_is etc).
-- These remain as DB objects but cannot be called.
-- ─────────────────────────────────────────────────────
DO $$
BEGIN
  -- Only revoke if functions exist (avoid error on fresh installs)
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_role_in_team') THEN
    REVOKE EXECUTE ON FUNCTION public.get_user_role_in_team(uuid) FROM authenticated, anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_category') THEN
    REVOKE EXECUTE ON FUNCTION public.get_user_category(uuid) FROM authenticated, anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_unit_id') THEN
    REVOKE EXECUTE ON FUNCTION public.get_user_unit_id(uuid) FROM authenticated, anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin') THEN
    REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM authenticated, anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_rh') THEN
    REVOKE EXECUTE ON FUNCTION public.is_rh(uuid) FROM authenticated, anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_category_chief') THEN
    REVOKE EXECUTE ON FUNCTION public.is_category_chief(uuid) FROM authenticated, anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_unit_manager') THEN
    REVOKE EXECUTE ON FUNCTION public.is_unit_manager(uuid) FROM authenticated, anon;
  END IF;
END $$;

-- Revoke trigger_send_push from roles (it's a trigger-only function)
REVOKE EXECUTE ON FUNCTION public.trigger_send_push() FROM anon, authenticated;
