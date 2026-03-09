
-- Tabela dedicada para unidades de saúde
CREATE TABLE public.units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view units"
  ON public.units FOR SELECT
  TO authenticated
  USING (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can insert units"
  ON public.units FOR INSERT
  TO authenticated
  WITH CHECK (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can update units"
  ON public.units FOR UPDATE
  TO authenticated
  USING (team_id = get_user_team_id(auth.uid()));

CREATE POLICY "Team members can delete units"
  ON public.units FOR DELETE
  TO authenticated
  USING (team_id = get_user_team_id(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER update_units_updated_at
  BEFORE UPDATE ON public.units
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
