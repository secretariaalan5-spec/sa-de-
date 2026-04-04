-- Fix performance indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_categories_team_id ON categories(team_id);
CREATE INDEX IF NOT EXISTS idx_employees_category_id ON employees(category_id);
CREATE INDEX IF NOT EXISTS idx_employees_team_id ON employees(team_id);
CREATE INDEX IF NOT EXISTS idx_employees_unit_id ON employees(unit_id);
CREATE INDEX IF NOT EXISTS idx_invites_category_id ON invites(category_id);
CREATE INDEX IF NOT EXISTS idx_invites_created_by ON invites(created_by);
CREATE INDEX IF NOT EXISTS idx_invites_team_id ON invites(team_id);
CREATE INDEX IF NOT EXISTS idx_invites_unit_id ON invites(unit_id);
CREATE INDEX IF NOT EXISTS idx_invites_used_by ON invites(used_by);
CREATE INDEX IF NOT EXISTS idx_leave_credits_employee_id ON leave_credits(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_credits_team_id ON leave_credits(team_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_decided_by ON leave_requests(decided_by);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_requested_by ON leave_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_leave_requests_team_id ON leave_requests(team_id);
CREATE INDEX IF NOT EXISTS idx_notifications_sender_id ON notifications(sender_id);
CREATE INDEX IF NOT EXISTS idx_notifications_team_id ON notifications(team_id);
CREATE INDEX IF NOT EXISTS idx_pending_approvals_reviewed_by ON pending_approvals(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_pending_approvals_team_id ON pending_approvals(team_id);
CREATE INDEX IF NOT EXISTS idx_prof_leave_requests_team_id ON professional_leave_requests(team_id);
CREATE INDEX IF NOT EXISTS idx_prof_users_team_id ON professional_users(team_id);
CREATE INDEX IF NOT EXISTS idx_schedules_created_by ON schedules(created_by);
CREATE INDEX IF NOT EXISTS idx_schedules_team_id ON schedules(team_id);
CREATE INDEX IF NOT EXISTS idx_schedules_unit_id ON schedules(unit_id);
CREATE INDEX IF NOT EXISTS idx_teams_created_by ON teams(created_by);
CREATE INDEX IF NOT EXISTS idx_transfer_history_employee_id ON transfer_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_transfer_history_from_unit_id ON transfer_history(from_unit_id);
CREATE INDEX IF NOT EXISTS idx_transfer_history_team_id ON transfer_history(team_id);
CREATE INDEX IF NOT EXISTS idx_transfer_history_to_unit_id ON transfer_history(to_unit_id);
CREATE INDEX IF NOT EXISTS idx_transfer_history_transferred_by ON transfer_history(transferred_by);
CREATE INDEX IF NOT EXISTS idx_units_team_id ON units(team_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_team_id ON user_roles(team_id);

-- Fix auth.uid() performance in RPCs (Init Plan / Subselects)
CREATE OR REPLACE FUNCTION public.user_is(_role text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.user_is_any(_roles text[])
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (select auth.uid()) AND role = ANY(_roles))
$$;

CREATE OR REPLACE FUNCTION public.user_category_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT category_id FROM public.user_roles WHERE user_id = (select auth.uid()) LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.user_category_ids()
RETURNS uuid[]
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT COALESCE(array_agg(category_id), '{}'::uuid[])
  FROM public.user_roles
  WHERE user_id = (select auth.uid()) AND category_id IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.user_unit_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT unit_id FROM public.user_roles WHERE user_id = (select auth.uid()) LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.user_team_id()
RETURNS uuid
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT team_id FROM public.user_roles WHERE user_id = (select auth.uid()) LIMIT 1
$$;

-- Fix Multi-Tenant Isolation (RLS Data Leaks)

-- 1. Units Isolation
DROP POLICY IF EXISTS "Team members can read units" ON public.units;
CREATE POLICY "Team members can read units" ON public.units FOR SELECT TO authenticated
USING (team_id = (SELECT public.user_team_id()));

DROP POLICY IF EXISTS "Admins can manage units" ON public.units;
CREATE POLICY "Admins can manage units" ON public.units FOR ALL TO authenticated
USING (public.user_is('admin') AND team_id = (SELECT public.user_team_id()))
WITH CHECK (public.user_is('admin') AND team_id = (SELECT public.user_team_id()));

-- 2. Categories Isolation
DROP POLICY IF EXISTS "Team members can read categories" ON public.categories;
CREATE POLICY "Team members can read categories" ON public.categories FOR SELECT TO authenticated
USING (team_id = (SELECT public.user_team_id()));

DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL TO authenticated
USING (public.user_is('admin') AND team_id = (SELECT public.user_team_id()))
WITH CHECK (public.user_is('admin') AND team_id = (SELECT public.user_team_id()));

-- 3. Teams Isolation
DROP POLICY IF EXISTS "Team members can read team" ON public.teams;
CREATE POLICY "Team members can read team" ON public.teams FOR SELECT TO authenticated
USING (id = (SELECT public.user_team_id()) OR created_by = (select auth.uid()));

-- 4. Professional Users Isolation
DROP POLICY IF EXISTS "Team members can read professional_users" ON public.professional_users;
CREATE POLICY "Team members can read professional_users" ON public.professional_users FOR SELECT TO authenticated
USING (team_id = (SELECT public.user_team_id()));

-- 5. Employees Admin Manage Isolation 
-- Although Admins could manage, they were previously not restricted to their team_id in the check.
DROP POLICY IF EXISTS "Admins and managers can delete employees" ON public.employees;
CREATE POLICY "Admins and managers can delete employees" ON public.employees FOR DELETE TO authenticated
USING (public.user_is_any(ARRAY['admin'::text, 'unit_manager'::text]) AND team_id = (SELECT public.user_team_id()));

DROP POLICY IF EXISTS "Admins and managers can insert employees" ON public.employees;
CREATE POLICY "Admins and managers can insert employees" ON public.employees FOR INSERT TO authenticated
WITH CHECK (public.user_is_any(ARRAY['admin'::text, 'unit_manager'::text]) AND team_id = (SELECT public.user_team_id()));

-- Update RLS init plan for performance on high-traffic tables
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO public
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO public
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO public
WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Chiefs and admins can delete schedules" ON public.schedules;
CREATE POLICY "Chiefs and admins can delete schedules" ON public.schedules FOR DELETE TO authenticated
USING (
  team_id = (SELECT public.user_team_id()) AND
  (
    public.user_is('admin') OR
    (public.user_is('category_chief') AND EXISTS (
      SELECT 1 FROM public.employees e 
      WHERE e.id = schedules.employee_id AND e.category_id = ANY (public.user_category_ids())
    ))
  )
);

DROP POLICY IF EXISTS "Chiefs and admins can update schedules" ON public.schedules;
CREATE POLICY "Chiefs and admins can update schedules" ON public.schedules FOR UPDATE TO authenticated
USING (
  team_id = (SELECT public.user_team_id()) AND
  (
    public.user_is('admin') OR
    (public.user_is('category_chief') AND EXISTS (
      SELECT 1 FROM public.employees e 
      WHERE e.id = schedules.employee_id AND e.category_id = ANY (public.user_category_ids())
    ))
  )
);

DROP POLICY IF EXISTS "Chiefs and admins can insert schedules" ON public.schedules;
CREATE POLICY "Chiefs and admins can insert schedules" ON public.schedules FOR INSERT TO authenticated
WITH CHECK (
  team_id = (SELECT public.user_team_id()) AND
  (
    public.user_is('admin') OR
    (public.user_is('category_chief') AND EXISTS (
      SELECT 1 FROM public.employees e 
      WHERE e.id = schedules.employee_id AND e.category_id = ANY (public.user_category_ids())
    ))
  )
);
