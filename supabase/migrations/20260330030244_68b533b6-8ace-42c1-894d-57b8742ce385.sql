
-- Fix infinite recursion on user_roles: replace self-referencing policy with has_role() SECURITY DEFINER function

-- Drop the recursive policy
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Recreate using the existing has_role() security definer function (no recursion)
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow users to insert their own role (needed during invite registration)
CREATE POLICY "Users can insert own role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Also fix all other policies that query user_roles via subquery (they work fine since they're on OTHER tables, but let's also make invites readable by anon for registration)
DROP POLICY IF EXISTS "Anyone can read invite by token" ON public.invites;
CREATE POLICY "Anyone can read invite by token"
ON public.invites
FOR SELECT
TO anon, authenticated
USING (true);

-- Allow anon users to mark invites as used during registration
CREATE POLICY "Anyone can update invite to mark used"
ON public.invites
FOR UPDATE
TO anon, authenticated
USING (used = false)
WITH CHECK (used = true);
