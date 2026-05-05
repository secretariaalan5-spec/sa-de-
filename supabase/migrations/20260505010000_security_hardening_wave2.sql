-- =====================================================
-- SECURITY HARDENING WAVE 2 (2026-05-05)
-- Fixes remaining vulnerabilities found in deep audit.
-- All changes are additive/safe — they only RESTRICT.
-- =====================================================

-- ─────────────────────────────────────────────────────
-- V1: notifications INSERT is WITH CHECK (true)
-- ANY authenticated user can insert notifications
-- targeting ANY user_id (impersonation / phishing).
-- Fix: Only admins can broadcast; users can only
-- receive via SECURITY DEFINER triggers.
-- ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "Admins and system can insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.user_is_any(ARRAY['admin', 'rh', 'category_chief'])
  );

-- ─────────────────────────────────────────────────────
-- V2: notify_leave_update() missing search_path
-- AND missing SET search_path (CWE-426).
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_leave_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  employee_name TEXT;
BEGIN
  IF NEW.status != OLD.status AND (NEW.status = 'approved' OR NEW.status = 'rejected') AND NEW.requested_by IS NOT NULL THEN

    SELECT name INTO employee_name FROM public.employees WHERE id = NEW.employee_id;

    INSERT INTO public.notifications (user_id, team_id, title, message, link)
    VALUES (
      NEW.requested_by,
      NEW.team_id,
      'Folga ' || CASE WHEN NEW.status = 'approved' THEN 'Aprovada' ELSE 'Negada' END,
      'A solicitação de folga para o profissional ' || COALESCE(employee_name, 'Desconhecido') || ' foi ' || CASE WHEN NEW.status = 'approved' THEN 'aprovada' ELSE 'negada' END || '.',
      '/folgas'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────
-- V3: employees SELECT/UPDATE missing team_id
-- An admin/chief from Team A can see/edit employees
-- of Team B. Fix by adding team_id guard.
-- ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Role-based read employees" ON public.employees;
CREATE POLICY "Role-based read employees" ON public.employees
  FOR SELECT TO authenticated
  USING (
    team_id = (SELECT public.user_team_id())
    AND (
      public.user_is_any(ARRAY['admin','rh'])
      OR (public.user_is('category_chief') AND category_id = ANY(public.user_category_ids()))
      OR (public.user_is('unit_manager') AND unit_id = (SELECT public.user_unit_id()))
    )
  );

DROP POLICY IF EXISTS "Role-based update employees" ON public.employees;
CREATE POLICY "Role-based update employees" ON public.employees
  FOR UPDATE TO authenticated
  USING (
    team_id = (SELECT public.user_team_id())
    AND (
      public.user_is_any(ARRAY['admin'])
      OR (public.user_is('category_chief') AND category_id = ANY(public.user_category_ids()))
      OR (public.user_is('unit_manager') AND unit_id = (SELECT public.user_unit_id()))
    )
  );

-- ─────────────────────────────────────────────────────
-- V4: schedules/leave_requests/leave_credits SELECT
-- policies missing team_id isolation
-- ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Role-based read schedules" ON public.schedules;
CREATE POLICY "Role-based read schedules" ON public.schedules
  FOR SELECT TO authenticated
  USING (
    team_id = (SELECT public.user_team_id())
    AND (
      public.user_is_any(ARRAY['admin','rh'])
      OR (public.user_is('category_chief') AND EXISTS (
        SELECT 1 FROM public.employees e WHERE e.id = schedules.employee_id AND e.category_id = ANY(public.user_category_ids())
      ))
      OR (public.user_is('unit_manager') AND EXISTS (
        SELECT 1 FROM public.employees e WHERE e.id = schedules.employee_id AND e.unit_id = (SELECT public.user_unit_id())
      ))
    )
  );

DROP POLICY IF EXISTS "Role-based read leave_requests" ON public.leave_requests;
CREATE POLICY "Role-based read leave_requests" ON public.leave_requests
  FOR SELECT TO authenticated
  USING (
    team_id = (SELECT public.user_team_id())
    AND (
      public.user_is_any(ARRAY['admin','rh'])
      OR (public.user_is('category_chief') AND EXISTS (
        SELECT 1 FROM public.employees e WHERE e.id = leave_requests.employee_id AND e.category_id = ANY(public.user_category_ids())
      ))
      OR (public.user_is('unit_manager') AND EXISTS (
        SELECT 1 FROM public.employees e WHERE e.id = leave_requests.employee_id AND e.unit_id = (SELECT public.user_unit_id())
      ))
    )
  );

DROP POLICY IF EXISTS "Role-based read leave_credits" ON public.leave_credits;
CREATE POLICY "Role-based read leave_credits" ON public.leave_credits
  FOR SELECT TO authenticated
  USING (
    team_id = (SELECT public.user_team_id())
    AND (
      public.user_is_any(ARRAY['admin','rh'])
      OR (public.user_is('category_chief') AND EXISTS (
        SELECT 1 FROM public.employees e WHERE e.id = leave_credits.employee_id AND e.category_id = ANY(public.user_category_ids())
      ))
      OR (public.user_is('unit_manager') AND EXISTS (
        SELECT 1 FROM public.employees e WHERE e.id = leave_credits.employee_id AND e.unit_id = (SELECT public.user_unit_id())
      ))
    )
  );

-- ─────────────────────────────────────────────────────
-- V5: transfer_history INSERT missing team_id +
-- SELECT missing team_id
-- ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Role-based read transfer_history" ON public.transfer_history;
CREATE POLICY "Role-based read transfer_history" ON public.transfer_history
  FOR SELECT TO authenticated
  USING (
    team_id = (SELECT public.user_team_id())
    AND (
      public.user_is_any(ARRAY['admin','rh'])
      OR (public.user_is('category_chief') AND EXISTS (
        SELECT 1 FROM public.employees e WHERE e.id = transfer_history.employee_id AND e.category_id = ANY(public.user_category_ids())
      ))
    )
  );

DROP POLICY IF EXISTS "Chiefs and admins can insert transfers" ON public.transfer_history;
CREATE POLICY "Team-scoped insert transfers" ON public.transfer_history
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_is_any(ARRAY['admin','category_chief'])
    AND team_id = (SELECT public.user_team_id())
  );

-- ─────────────────────────────────────────────────────
-- V6: holidays SELECT uses USING(true) — any
-- authenticated user reads ALL teams' holidays.
-- ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Team members can read holidays" ON public.holidays;
CREATE POLICY "Team members can read holidays" ON public.holidays
  FOR SELECT TO authenticated
  USING (team_id = (SELECT public.user_team_id()));

DROP POLICY IF EXISTS "Admins can manage holidays" ON public.holidays;
CREATE POLICY "Admins can manage holidays" ON public.holidays
  FOR INSERT TO authenticated
  WITH CHECK (
    public.user_is('admin')
    AND team_id = (SELECT public.user_team_id())
  );

DROP POLICY IF EXISTS "Admins can update holidays" ON public.holidays;
CREATE POLICY "Admins can update holidays" ON public.holidays
  FOR UPDATE TO authenticated
  USING (
    public.user_is('admin')
    AND team_id = (SELECT public.user_team_id())
  );

DROP POLICY IF EXISTS "Admins can delete holidays" ON public.holidays;
CREATE POLICY "Admins can delete holidays" ON public.holidays
  FOR DELETE TO authenticated
  USING (
    public.user_is('admin')
    AND team_id = (SELECT public.user_team_id())
  );

-- ─────────────────────────────────────────────────────
-- V7: Vercel security headers — prevent clickjacking,
-- MIME sniffing, and enforce HTTPS.
-- (This is handled via vercel.json headers, not SQL)
-- ─────────────────────────────────────────────────────
-- See vercel.json changes in this commit.

-- ─────────────────────────────────────────────────────
-- V8: Revoke notify_leave_update from direct execution
-- (it's a trigger function, should never be called
-- directly by clients).
-- ─────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.notify_leave_update() FROM anon, authenticated;
