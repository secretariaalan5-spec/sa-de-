-- 1. CREATE MISSING TRIGGERS
CREATE TRIGGER trg_on_extra_schedule_insert
  AFTER INSERT ON public.schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.on_extra_schedule_insert();

CREATE TRIGGER trg_on_leave_approved
  AFTER UPDATE ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.on_leave_approved();

-- 2. SECURITY DEFINER helper functions
CREATE OR REPLACE FUNCTION public.user_is(_role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.user_is_any(_roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = ANY(_roles)) $$;

CREATE OR REPLACE FUNCTION public.user_category_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT category_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1 $$;

CREATE OR REPLACE FUNCTION public.user_unit_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT unit_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1 $$;

-- 3. REPLACE RLS POLICIES — categories
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL TO authenticated
USING (public.user_is('admin')) WITH CHECK (public.user_is('admin'));

-- employees
DROP POLICY IF EXISTS "Admins and RH can read all employees" ON public.employees;
CREATE POLICY "Role-based read employees" ON public.employees FOR SELECT TO authenticated
USING (public.user_is_any(ARRAY['admin','rh']) OR (public.user_is('category_chief') AND category_id = public.user_category_id()) OR (public.user_is('unit_manager') AND unit_id = public.user_unit_id()));

DROP POLICY IF EXISTS "Admins and managers can insert employees" ON public.employees;
CREATE POLICY "Admins and managers can insert employees" ON public.employees FOR INSERT TO authenticated
WITH CHECK (public.user_is_any(ARRAY['admin','unit_manager']));

DROP POLICY IF EXISTS "Admins and chiefs can update employees" ON public.employees;
CREATE POLICY "Admins and chiefs can update employees" ON public.employees FOR UPDATE TO authenticated
USING (public.user_is_any(ARRAY['admin','category_chief']));

DROP POLICY IF EXISTS "Only admins can delete employees" ON public.employees;
CREATE POLICY "Only admins can delete employees" ON public.employees FOR DELETE TO authenticated
USING (public.user_is('admin'));

-- schedules
DROP POLICY IF EXISTS "Role-based read schedules" ON public.schedules;
CREATE POLICY "Role-based read schedules" ON public.schedules FOR SELECT TO authenticated
USING (public.user_is_any(ARRAY['admin','rh']) OR (public.user_is('category_chief') AND EXISTS (SELECT 1 FROM employees e WHERE e.id = schedules.employee_id AND e.category_id = public.user_category_id())) OR (public.user_is('unit_manager') AND EXISTS (SELECT 1 FROM employees e WHERE e.id = schedules.employee_id AND e.unit_id = public.user_unit_id())));

DROP POLICY IF EXISTS "Chiefs and admins can insert schedules" ON public.schedules;
CREATE POLICY "Chiefs and admins can insert schedules" ON public.schedules FOR INSERT TO authenticated
WITH CHECK (public.user_is_any(ARRAY['admin','category_chief']));

DROP POLICY IF EXISTS "Chiefs and admins can update schedules" ON public.schedules;
CREATE POLICY "Chiefs and admins can update schedules" ON public.schedules FOR UPDATE TO authenticated
USING (public.user_is_any(ARRAY['admin','category_chief']));

DROP POLICY IF EXISTS "Chiefs and admins can delete schedules" ON public.schedules;
CREATE POLICY "Chiefs and admins can delete schedules" ON public.schedules FOR DELETE TO authenticated
USING (public.user_is_any(ARRAY['admin','category_chief']));

-- leave_requests
DROP POLICY IF EXISTS "Role-based read leave_requests" ON public.leave_requests;
CREATE POLICY "Role-based read leave_requests" ON public.leave_requests FOR SELECT TO authenticated
USING (public.user_is_any(ARRAY['admin','rh']) OR (public.user_is('category_chief') AND EXISTS (SELECT 1 FROM employees e WHERE e.id = leave_requests.employee_id AND e.category_id = public.user_category_id())) OR (public.user_is('unit_manager') AND EXISTS (SELECT 1 FROM employees e WHERE e.id = leave_requests.employee_id AND e.unit_id = public.user_unit_id())));

DROP POLICY IF EXISTS "Managers and admins can insert leave_requests" ON public.leave_requests;
CREATE POLICY "Managers and admins can insert leave_requests" ON public.leave_requests FOR INSERT TO authenticated
WITH CHECK (public.user_is_any(ARRAY['admin','unit_manager']));

DROP POLICY IF EXISTS "Chiefs and admins can update leave_requests" ON public.leave_requests;
CREATE POLICY "Chiefs and admins can update leave_requests" ON public.leave_requests FOR UPDATE TO authenticated
USING (public.user_is_any(ARRAY['admin','category_chief']));

-- leave_credits
DROP POLICY IF EXISTS "Role-based read leave_credits" ON public.leave_credits;
CREATE POLICY "Role-based read leave_credits" ON public.leave_credits FOR SELECT TO authenticated
USING (public.user_is_any(ARRAY['admin','rh']) OR (public.user_is('category_chief') AND EXISTS (SELECT 1 FROM employees e WHERE e.id = leave_credits.employee_id AND e.category_id = public.user_category_id())) OR (public.user_is('unit_manager') AND EXISTS (SELECT 1 FROM employees e WHERE e.id = leave_credits.employee_id AND e.unit_id = public.user_unit_id())));

DROP POLICY IF EXISTS "System can insert leave_credits" ON public.leave_credits;
CREATE POLICY "Chiefs and admins can insert leave_credits" ON public.leave_credits FOR INSERT TO authenticated
WITH CHECK (public.user_is_any(ARRAY['admin','category_chief']));

-- transfer_history
DROP POLICY IF EXISTS "Role-based read transfer_history" ON public.transfer_history;
CREATE POLICY "Role-based read transfer_history" ON public.transfer_history FOR SELECT TO authenticated
USING (public.user_is_any(ARRAY['admin','rh']) OR (public.user_is('category_chief') AND EXISTS (SELECT 1 FROM employees e WHERE e.id = transfer_history.employee_id AND e.category_id = public.user_category_id())));

DROP POLICY IF EXISTS "Chiefs and admins can insert transfers" ON public.transfer_history;
CREATE POLICY "Chiefs and admins can insert transfers" ON public.transfer_history FOR INSERT TO authenticated
WITH CHECK (public.user_is_any(ARRAY['admin','category_chief']));

-- units
DROP POLICY IF EXISTS "Admins can manage units" ON public.units;
CREATE POLICY "Admins can manage units" ON public.units FOR ALL TO authenticated
USING (public.user_is('admin')) WITH CHECK (public.user_is('admin'));

-- invites
DROP POLICY IF EXISTS "Admins can manage invites" ON public.invites;
CREATE POLICY "Admins can manage invites" ON public.invites FOR ALL TO authenticated
USING (public.user_is('admin')) WITH CHECK (public.user_is('admin'));

-- professional_users
DROP POLICY IF EXISTS "Admins can insert professional_users" ON public.professional_users;
CREATE POLICY "Admins can insert professional_users" ON public.professional_users FOR INSERT TO authenticated
WITH CHECK (public.user_is_any(ARRAY['admin','category_chief','unit_manager']));

DROP POLICY IF EXISTS "Admins can update professional_users" ON public.professional_users;
CREATE POLICY "Admins can update professional_users" ON public.professional_users FOR UPDATE TO authenticated
USING (public.user_is_any(ARRAY['admin','category_chief']));

-- professional_leave_requests
DROP POLICY IF EXISTS "Managers can insert prof_leave_requests" ON public.professional_leave_requests;
CREATE POLICY "Managers can insert prof_leave_requests" ON public.professional_leave_requests FOR INSERT TO authenticated
WITH CHECK (public.user_is_any(ARRAY['admin','unit_manager']));

DROP POLICY IF EXISTS "Admins can delete prof_leave_requests" ON public.professional_leave_requests;
CREATE POLICY "Admins can delete prof_leave_requests" ON public.professional_leave_requests FOR DELETE TO authenticated
USING (public.user_is_any(ARRAY['admin','category_chief']));