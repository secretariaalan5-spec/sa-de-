
-- Allow admin and unit_manager to delete employees (soft delete via active=false or hard delete)
DROP POLICY IF EXISTS "Only admins can delete employees" ON public.employees;
CREATE POLICY "Admins and managers can delete employees" ON public.employees
FOR DELETE TO authenticated
USING (user_is_any(ARRAY['admin', 'unit_manager']));
