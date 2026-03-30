
-- 1. Allow anon/unauthenticated users to read team_members by invite_token (for InvitePage)
-- We need a policy that allows SELECT when filtering by invite_token
-- Since anon users can't use auth.uid(), we add a policy for the anon role
CREATE POLICY "anon_read_invite_by_token"
ON public.team_members
FOR SELECT
TO anon
USING (invite_token IS NOT NULL AND status = 'pending');

-- 2. Allow invited users (authenticated but not yet in team) to update their own invite
-- Already covered by existing tm_update policy (member_email match)

-- 3. Fix handle_new_user trigger to NOT create team when user has a pending invite
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_team_id uuid;
  pending_invite record;
BEGIN
  -- Check if this user has a pending team_members invite
  SELECT tm.team_id INTO pending_invite
  FROM public.team_members tm
  WHERE tm.member_email = LOWER(NEW.email)
    AND tm.status = 'pending'
  LIMIT 1;

  IF pending_invite.team_id IS NOT NULL THEN
    -- User was invited: create profile linked to the inviter's team, NO new team created
    INSERT INTO public.profiles (user_id, team_id, display_name)
    VALUES (
      NEW.id,
      pending_invite.team_id,
      COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email, '')
    );
    -- Do NOT create a user_role here; useAutoAcceptInvite will handle it
  ELSE
    -- New independent user: create their own team
    INSERT INTO public.teams (name, created_by)
    VALUES ('Minha Equipe', NEW.id)
    RETURNING id INTO new_team_id;

    INSERT INTO public.profiles (user_id, team_id, display_name)
    VALUES (
      NEW.id,
      new_team_id,
      COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email, '')
    );

    -- Auto-assign admin role
    INSERT INTO public.user_roles (user_id, role, team_id)
    VALUES (NEW.id, 'admin', new_team_id);
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Also allow anon to read units (for manager onboarding / selection)
CREATE POLICY "anon_read_units"
ON public.units
FOR SELECT
TO anon
USING (true);
