-- Fix DELETE policy for schedules
DROP POLICY IF EXISTS "Chiefs and admins can delete schedules" ON public.schedules;
CREATE POLICY "Chiefs and admins can delete schedules" ON public.schedules FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.employees e ON e.id = public.schedules.employee_id
    WHERE ur.user_id = auth.uid() AND ur.role = 'category_chief' AND ur.category_id = e.category_id
  )
);

-- Fix UPDATE policy for schedules
DROP POLICY IF EXISTS "Chiefs and admins can update schedules" ON public.schedules;
CREATE POLICY "Chiefs and admins can update schedules" ON public.schedules FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.employees e ON e.id = public.schedules.employee_id
    WHERE ur.user_id = auth.uid() AND ur.role = 'category_chief' AND ur.category_id = e.category_id
  )
);

-- Fix INSERT policy for schedules
DROP POLICY IF EXISTS "Chiefs and admins can insert schedules" ON public.schedules;
CREATE POLICY "Chiefs and admins can insert schedules" ON public.schedules FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.employees e ON e.id = public.schedules.employee_id
    WHERE ur.user_id = auth.uid() AND ur.role = 'category_chief' AND ur.category_id = e.category_id
  )
);
