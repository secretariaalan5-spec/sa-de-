-- Add team_id to category_invites
ALTER TABLE public.category_invites ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id);

-- Make it cascade or something similar
-- Wait, if there are existing rows, we might need to set a default team_id first, but local dev usually just drops. Or we can just set it cleanly.
UPDATE public.category_invites SET team_id = (SELECT id FROM public.teams LIMIT 1) WHERE team_id IS NULL;

-- Enable RLS for team filtering
CREATE POLICY "Admins can see team category invites"
  ON public.category_invites
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.team_id = category_invites.team_id
    )
  );
