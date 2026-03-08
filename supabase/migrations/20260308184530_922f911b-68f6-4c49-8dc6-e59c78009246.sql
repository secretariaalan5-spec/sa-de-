
-- Drop ALL existing policies on professional_leave_requests
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'professional_leave_requests' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.professional_leave_requests', pol.policyname);
  END LOOP;
END;
$$;

-- Recreate as PERMISSIVE (explicit)
CREATE POLICY "admins_select_leave_requests"
ON public.professional_leave_requests
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "users_select_own_leave_requests"
ON public.professional_leave_requests
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_leave_requests"
ON public.professional_leave_requests
AS PERMISSIVE
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "admins_update_leave_requests"
ON public.professional_leave_requests
AS PERMISSIVE
FOR UPDATE
TO authenticated
USING (team_id = get_user_team_id(auth.uid()))
WITH CHECK (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "admins_delete_leave_requests"
ON public.professional_leave_requests
AS PERMISSIVE
FOR DELETE
TO authenticated
USING (team_id = get_user_team_id(auth.uid()));
