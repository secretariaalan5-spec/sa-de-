
-- Tabela para vincular usuários Google a profissionais do sistema
CREATE TABLE public.professional_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  professional_id text, -- ID do profissional no JSON de service_state
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'tech', -- nurse, tech, emult
  status text NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.professional_users ENABLE ROW LEVEL SECURITY;

-- Profissional pode ver seu próprio registro
CREATE POLICY "Users can view own professional_user"
  ON public.professional_users FOR SELECT
  USING (user_id = auth.uid());

-- Admins da equipe podem ver e gerenciar
CREATE POLICY "Team admins can view professional_users"
  ON public.professional_users FOR SELECT
  USING (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team admins can update professional_users"
  ON public.professional_users FOR UPDATE
  USING (team_id = get_user_team_id(auth.uid()));

-- Qualquer autenticado pode se registrar
CREATE POLICY "Authenticated users can insert own record"
  ON public.professional_users FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Trigger para updated_at
CREATE TRIGGER update_professional_users_updated_at
  BEFORE UPDATE ON public.professional_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de pedidos de folga feitos por profissionais
CREATE TABLE public.professional_leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  professional_id text NOT NULL,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'tech',
  leave_type text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_requested integer NOT NULL DEFAULT 1,
  observations text,
  status text NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.professional_leave_requests ENABLE ROW LEVEL SECURITY;

-- Profissional pode ver e criar seus próprios pedidos
CREATE POLICY "Users can view own leave requests"
  ON public.professional_leave_requests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own leave requests"
  ON public.professional_leave_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins da equipe podem ver e gerenciar
CREATE POLICY "Team admins can view leave requests"
  ON public.professional_leave_requests FOR SELECT
  USING (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team admins can update leave requests"
  ON public.professional_leave_requests FOR UPDATE
  USING (team_id = get_user_team_id(auth.uid()));

CREATE TRIGGER update_professional_leave_requests_updated_at
  BEFORE UPDATE ON public.professional_leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
