
-- 1. Ensure trigger exists on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 2. Add INSERT policy on teams so fallback code works
CREATE POLICY "Authenticated users can create their own team"
  ON public.teams FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- 3. Fix existing user b84c0309 who has no team/profile
DO $$
DECLARE
  _uid uuid := 'b84c0309-d789-40e5-93bf-df3eed05ed36';
  _team_id uuid;
  _existing_team uuid;
  _existing_profile uuid;
BEGIN
  -- Check if team already exists
  SELECT id INTO _existing_team FROM public.teams WHERE created_by = _uid LIMIT 1;
  
  IF _existing_team IS NULL THEN
    INSERT INTO public.teams (name, created_by) VALUES ('Minha Equipe', _uid) RETURNING id INTO _team_id;
  ELSE
    _team_id := _existing_team;
  END IF;
  
  -- Check if profile exists
  SELECT id INTO _existing_profile FROM public.profiles WHERE user_id = _uid LIMIT 1;
  
  IF _existing_profile IS NULL THEN
    INSERT INTO public.profiles (user_id, team_id, display_name) VALUES (_uid, _team_id, 'alan mendes');
  ELSE
    UPDATE public.profiles SET team_id = _team_id WHERE user_id = _uid AND team_id IS NULL;
  END IF;
END $$;

-- 4. Add ON DELETE CASCADE to all tables referencing users
-- professional_users: allow admin to delete
CREATE POLICY "Team admins can delete professional_users"
  ON public.professional_users FOR DELETE TO authenticated
  USING (team_id = get_user_team_id(auth.uid()));

-- professional_leave_requests: allow admin to delete
CREATE POLICY "Team admins can delete leave requests"
  ON public.professional_leave_requests FOR DELETE TO authenticated
  USING (team_id = get_user_team_id(auth.uid()));

-- Create a cleanup function for when users are deleted from Supabase dashboard
CREATE OR REPLACE FUNCTION public.cleanup_user_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.professional_users WHERE user_id = OLD.id;
  DELETE FROM public.professional_leave_requests WHERE user_id = OLD.id;
  DELETE FROM public.admin_states WHERE user_id = OLD.id;
  DELETE FROM public.profiles WHERE user_id = OLD.id;
  DELETE FROM public.activity_log WHERE user_id = OLD.id;
  -- Delete teams created by this user
  DELETE FROM public.teams WHERE created_by = OLD.id;
  RETURN OLD;
END;
$$;

-- Attach cleanup trigger BEFORE delete on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_deleted
  BEFORE DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_user_data();
