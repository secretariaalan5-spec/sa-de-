
-- 1. Teams table
CREATE TABLE public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Minha Equipe',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- 2. Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  display_name text NOT NULL DEFAULT '',
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Team invites table
CREATE TABLE public.team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  code text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- 4. Activity log table
CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  action text NOT NULL,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- 5. Helper function: get team_id for a user
CREATE OR REPLACE FUNCTION public.get_user_team_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- 6. RLS Policies

-- Teams: members can view their own team
CREATE POLICY "Members can view their team"
  ON public.teams FOR SELECT TO authenticated
  USING (id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Creator can update team"
  ON public.teams FOR UPDATE TO authenticated
  USING (id = public.get_user_team_id(auth.uid()));

-- Profiles: team members can see each other
CREATE POLICY "Users can view team profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (team_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Team invites: team members can manage
CREATE POLICY "Team members can view invites"
  ON public.team_invites FOR SELECT TO authenticated
  USING (team_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Team members can create invites"
  ON public.team_invites FOR INSERT TO authenticated
  WITH CHECK (team_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Anyone can view invite by code"
  ON public.team_invites FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can claim invite"
  ON public.team_invites FOR UPDATE TO authenticated
  USING (used_by IS NULL OR used_by = auth.uid());

-- Activity log: team members can view
CREATE POLICY "Team members can view activity"
  ON public.activity_log FOR SELECT TO authenticated
  USING (team_id = public.get_user_team_id(auth.uid()));

CREATE POLICY "Team members can insert activity"
  ON public.activity_log FOR INSERT TO authenticated
  WITH CHECK (team_id = public.get_user_team_id(auth.uid()) AND user_id = auth.uid());

-- 7. Auto-create profile + team on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_team_id uuid;
BEGIN
  -- Create a team for the new user
  INSERT INTO public.teams (name, created_by)
  VALUES ('Minha Equipe', NEW.id)
  RETURNING id INTO new_team_id;

  -- Create profile linked to that team
  INSERT INTO public.profiles (user_id, team_id, display_name)
  VALUES (
    NEW.id,
    new_team_id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email, '')
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 8. Update timestamp trigger for profiles
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
