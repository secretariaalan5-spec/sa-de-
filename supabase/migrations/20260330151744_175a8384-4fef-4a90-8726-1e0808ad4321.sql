
-- Drop old unique index that prevents multiple categories per chief
DROP INDEX IF EXISTS idx_user_roles_user_role_unique;

-- Create new unique index allowing multiple rows with different category_ids
CREATE UNIQUE INDEX idx_user_roles_unique 
ON public.user_roles (user_id, role, COALESCE(category_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(unit_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Create function to get all category_ids for current user
CREATE OR REPLACE FUNCTION public.user_category_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(category_id), '{}'::uuid[])
  FROM public.user_roles
  WHERE user_id = auth.uid() AND category_id IS NOT NULL
$$;

-- Update employees SELECT policy
DROP POLICY IF EXISTS "Role-based read employees" ON public.employees;
CREATE POLICY "Role-based read employees" ON public.employees
FOR SELECT TO authenticated
USING (
  user_is_any(ARRAY['admin','rh'])
  OR (user_is('category_chief') AND category_id = ANY(user_category_ids()))
  OR (user_is('unit_manager') AND unit_id = user_unit_id())
);

-- Update employees UPDATE policy
DROP POLICY IF EXISTS "Role-based update employees" ON public.employees;
CREATE POLICY "Role-based update employees" ON public.employees
FOR UPDATE TO authenticated
USING (
  user_is_any(ARRAY['admin']) 
  OR (user_is('category_chief') AND category_id = ANY(user_category_ids()))
  OR (user_is('unit_manager') AND unit_id = user_unit_id())
);

-- Update leave_credits SELECT policy
DROP POLICY IF EXISTS "Role-based read leave_credits" ON public.leave_credits;
CREATE POLICY "Role-based read leave_credits" ON public.leave_credits
FOR SELECT TO authenticated
USING (
  user_is_any(ARRAY['admin','rh'])
  OR (user_is('category_chief') AND EXISTS (
    SELECT 1 FROM employees e WHERE e.id = leave_credits.employee_id AND e.category_id = ANY(user_category_ids())
  ))
  OR (user_is('unit_manager') AND EXISTS (
    SELECT 1 FROM employees e WHERE e.id = leave_credits.employee_id AND e.unit_id = user_unit_id()
  ))
);

-- Update leave_requests SELECT policy
DROP POLICY IF EXISTS "Role-based read leave_requests" ON public.leave_requests;
CREATE POLICY "Role-based read leave_requests" ON public.leave_requests
FOR SELECT TO authenticated
USING (
  user_is_any(ARRAY['admin','rh'])
  OR (user_is('category_chief') AND EXISTS (
    SELECT 1 FROM employees e WHERE e.id = leave_requests.employee_id AND e.category_id = ANY(user_category_ids())
  ))
  OR (user_is('unit_manager') AND EXISTS (
    SELECT 1 FROM employees e WHERE e.id = leave_requests.employee_id AND e.unit_id = user_unit_id()
  ))
);

-- Update schedules SELECT policy
DROP POLICY IF EXISTS "Role-based read schedules" ON public.schedules;
CREATE POLICY "Role-based read schedules" ON public.schedules
FOR SELECT TO authenticated
USING (
  user_is_any(ARRAY['admin','rh'])
  OR (user_is('category_chief') AND EXISTS (
    SELECT 1 FROM employees e WHERE e.id = schedules.employee_id AND e.category_id = ANY(user_category_ids())
  ))
  OR (user_is('unit_manager') AND EXISTS (
    SELECT 1 FROM employees e WHERE e.id = schedules.employee_id AND e.unit_id = user_unit_id()
  ))
);

-- Update transfer_history SELECT policy
DROP POLICY IF EXISTS "Role-based read transfer_history" ON public.transfer_history;
CREATE POLICY "Role-based read transfer_history" ON public.transfer_history
FOR SELECT TO authenticated
USING (
  user_is_any(ARRAY['admin','rh'])
  OR (user_is('category_chief') AND EXISTS (
    SELECT 1 FROM employees e WHERE e.id = transfer_history.employee_id AND e.category_id = ANY(user_category_ids())
  ))
);
