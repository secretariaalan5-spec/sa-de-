-- Allow admins to delete invites
CREATE POLICY "Admins can delete invites"
ON public.invites
FOR DELETE
TO authenticated
USING (user_is('admin'::text));