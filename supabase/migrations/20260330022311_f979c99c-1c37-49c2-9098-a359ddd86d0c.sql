
-- =============================================
-- 1. PROFILES (user metadata linked to auth)
-- =============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name text NOT NULL DEFAULT '',
  avatar_url text,
  team_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 2. TEAMS
-- =============================================
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Equipe Principal',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can read team" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "Creators can insert teams" ON public.teams FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

-- =============================================
-- 3. ADMIN_STATES (JSON state persistence)
-- =============================================
CREATE TABLE IF NOT EXISTS public.admin_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  emult_state jsonb DEFAULT '{}'::jsonb,
  service_state jsonb DEFAULT '{}'::jsonb,
  portal_codes jsonb DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own admin_states" ON public.admin_states FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 4. USER_ROLES (RBAC)
-- =============================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'admin',
  category text,
  category_id uuid,
  unit_id uuid,
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
);

-- =============================================
-- 5. CATEGORIES (dynamic professional categories)
-- =============================================
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can read categories" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage categories" ON public.categories FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
);

-- =============================================
-- 6. UNITS (health units)
-- =============================================
CREATE TABLE IF NOT EXISTS public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can read units" ON public.units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage units" ON public.units FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
);

-- =============================================
-- 7. EMPLOYEES (professionals without login)
-- =============================================
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  monthly_hours integer NOT NULL DEFAULT 40,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and RH can read all employees" ON public.employees FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'rh'))
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'category_chief' AND ur.category_id = public.employees.category_id)
  OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'unit_manager' AND ur.unit_id = public.employees.unit_id)
);

CREATE POLICY "Admins and managers can insert employees" ON public.employees FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'unit_manager'))
);

CREATE POLICY "Admins and chiefs can update employees" ON public.employees FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'category_chief'))
);

CREATE POLICY "Only admins can delete employees" ON public.employees FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
);

-- =============================================
-- 8. SCHEDULES (normal and extra shifts)
-- =============================================
CREATE TABLE IF NOT EXISTS public.schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  type text NOT NULL DEFAULT 'normal',
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Role-based read schedules" ON public.schedules FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'rh'))
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.employees e ON e.id = public.schedules.employee_id
    WHERE ur.user_id = auth.uid() AND ur.role = 'category_chief' AND ur.category_id = e.category_id
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.employees e ON e.id = public.schedules.employee_id
    WHERE ur.user_id = auth.uid() AND ur.role = 'unit_manager' AND ur.unit_id = e.unit_id
  )
);

CREATE POLICY "Chiefs and admins can insert schedules" ON public.schedules FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'category_chief'))
);

CREATE POLICY "Chiefs and admins can update schedules" ON public.schedules FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'category_chief'))
);

CREATE POLICY "Chiefs and admins can delete schedules" ON public.schedules FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'category_chief'))
);

-- =============================================
-- 9. LEAVE_CREDITS (saldo de folgas: +2 extra, -1 uso)
-- =============================================
CREATE TABLE IF NOT EXISTS public.leave_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  amount integer NOT NULL,
  origin text NOT NULL,
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leave_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Role-based read leave_credits" ON public.leave_credits FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'rh'))
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.employees e ON e.id = public.leave_credits.employee_id
    WHERE ur.user_id = auth.uid() AND ur.role = 'category_chief' AND ur.category_id = e.category_id
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.employees e ON e.id = public.leave_credits.employee_id
    WHERE ur.user_id = auth.uid() AND ur.role = 'unit_manager' AND ur.unit_id = e.unit_id
  )
);

CREATE POLICY "System can insert leave_credits" ON public.leave_credits FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'category_chief'))
);

-- =============================================
-- 10. LEAVE_REQUESTS (pedidos de folga)
-- =============================================
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  leave_dates date[] NOT NULL DEFAULT '{}',
  days_requested integer NOT NULL DEFAULT 1,
  observations text,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Role-based read leave_requests" ON public.leave_requests FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'rh'))
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.employees e ON e.id = public.leave_requests.employee_id
    WHERE ur.user_id = auth.uid() AND ur.role = 'category_chief' AND ur.category_id = e.category_id
  )
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.employees e ON e.id = public.leave_requests.employee_id
    WHERE ur.user_id = auth.uid() AND ur.role = 'unit_manager' AND ur.unit_id = e.unit_id
  )
);

CREATE POLICY "Managers and admins can insert leave_requests" ON public.leave_requests FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'unit_manager'))
);

CREATE POLICY "Chiefs and admins can update leave_requests" ON public.leave_requests FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'category_chief'))
);

-- =============================================
-- 11. INVITES (secure token-based invitations)
-- =============================================
CREATE TABLE IF NOT EXISTS public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  role text NOT NULL DEFAULT 'unit_manager',
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  used boolean NOT NULL DEFAULT false,
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage invites" ON public.invites FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
);

CREATE POLICY "Anyone can read invite by token" ON public.invites FOR SELECT TO authenticated USING (true);

-- =============================================
-- 12. TRANSFER_HISTORY (employee transfers)
-- =============================================
CREATE TABLE IF NOT EXISTS public.transfer_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE NOT NULL,
  from_unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  to_unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  transferred_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  transferred_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transfer_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Role-based read transfer_history" ON public.transfer_history FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'rh'))
  OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.employees e ON e.id = public.transfer_history.employee_id
    WHERE ur.user_id = auth.uid() AND ur.role = 'category_chief' AND ur.category_id = e.category_id
  )
);

CREATE POLICY "Chiefs and admins can insert transfers" ON public.transfer_history FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'category_chief'))
);

-- =============================================
-- 13. PROFESSIONAL_USERS (portal registrations - legacy)
-- =============================================
CREATE TABLE IF NOT EXISTS public.professional_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  professional_id text,
  full_name text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  function_name text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.professional_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can read professional_users" ON public.professional_users FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert professional_users" ON public.professional_users FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update professional_users" ON public.professional_users FOR UPDATE TO authenticated USING (true);

-- =============================================
-- 14. PROFESSIONAL_LEAVE_REQUESTS (portal leave - legacy)
-- =============================================
CREATE TABLE IF NOT EXISTS public.professional_leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  professional_id text,
  leave_dates date[] DEFAULT '{}',
  days_requested integer DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  observations text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.professional_leave_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can read prof_leave_requests" ON public.professional_leave_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert prof_leave_requests" ON public.professional_leave_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can delete prof_leave_requests" ON public.professional_leave_requests FOR DELETE TO authenticated USING (true);

-- =============================================
-- 15. TRIGGER: auto-generate +2 credits on extra schedule
-- =============================================
CREATE OR REPLACE FUNCTION public.on_extra_schedule_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'extra' THEN
    INSERT INTO public.leave_credits (team_id, employee_id, amount, origin, reference_id)
    VALUES (NEW.team_id, NEW.employee_id, 2, 'extra_shift', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_extra_schedule_credits
AFTER INSERT ON public.schedules
FOR EACH ROW
EXECUTE FUNCTION public.on_extra_schedule_insert();

-- =============================================
-- 16. TRIGGER: auto-deduct -1 credit on approved leave
-- =============================================
CREATE OR REPLACE FUNCTION public.on_leave_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    INSERT INTO public.leave_credits (team_id, employee_id, amount, origin, reference_id)
    VALUES (NEW.team_id, NEW.employee_id, -1 * NEW.days_requested, 'leave_used', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_leave_approved_deduct
AFTER UPDATE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.on_leave_approved();

-- =============================================
-- 17. TRIGGER: auto-create profile on signup
-- =============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', ''))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 18. SECURITY DEFINER: has_role helper
-- =============================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
