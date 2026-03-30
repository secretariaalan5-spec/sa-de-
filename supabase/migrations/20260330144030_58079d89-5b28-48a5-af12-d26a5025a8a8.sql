-- Allow admins to read all profiles to see participant names
CREATE POLICY "Admins can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_is('admin'::text));