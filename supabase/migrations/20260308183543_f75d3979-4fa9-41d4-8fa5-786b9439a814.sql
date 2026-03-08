-- Drop the restrictive UPDATE policy and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Team admins can update leave requests" ON public.professional_leave_requests;

CREATE POLICY "Team admins can update leave requests"
ON public.professional_leave_requests
FOR UPDATE
TO authenticated
USING (team_id = get_user_team_id(auth.uid()))
WITH CHECK (team_id = get_user_team_id(auth.uid()));

-- Also fix DELETE policy to be PERMISSIVE
DROP POLICY IF EXISTS "Team admins can delete leave requests" ON public.professional_leave_requests;

CREATE POLICY "Team admins can delete leave requests"
ON public.professional_leave_requests
FOR DELETE
TO authenticated
USING (team_id = get_user_team_id(auth.uid()));

-- Also fix SELECT policies to be PERMISSIVE
DROP POLICY IF EXISTS "Team admins can view leave requests" ON public.professional_leave_requests;

CREATE POLICY "Team admins can view leave requests"
ON public.professional_leave_requests
FOR SELECT
TO authenticated
USING (team_id = get_user_team_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view own leave requests" ON public.professional_leave_requests;

CREATE POLICY "Users can view own leave requests"
ON public.professional_leave_requests
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create own leave requests" ON public.professional_leave_requests;

CREATE POLICY "Users can create own leave requests"
ON public.professional_leave_requests
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());