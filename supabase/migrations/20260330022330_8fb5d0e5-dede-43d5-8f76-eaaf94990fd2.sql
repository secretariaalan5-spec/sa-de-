
-- Fix permissive RLS on professional_users
DROP POLICY IF EXISTS "Authenticated can insert professional_users" ON public.professional_users;
DROP POLICY IF EXISTS "Authenticated can update professional_users" ON public.professional_users;
CREATE POLICY "Admins can insert professional_users" ON public.professional_users FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'category_chief', 'unit_manager'))
);
CREATE POLICY "Admins can update professional_users" ON public.professional_users FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'category_chief'))
);

-- Fix permissive RLS on professional_leave_requests
DROP POLICY IF EXISTS "Authenticated can insert prof_leave_requests" ON public.professional_leave_requests;
DROP POLICY IF EXISTS "Authenticated can delete prof_leave_requests" ON public.professional_leave_requests;
CREATE POLICY "Managers can insert prof_leave_requests" ON public.professional_leave_requests FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'unit_manager'))
);
CREATE POLICY "Admins can delete prof_leave_requests" ON public.professional_leave_requests FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'category_chief'))
);
