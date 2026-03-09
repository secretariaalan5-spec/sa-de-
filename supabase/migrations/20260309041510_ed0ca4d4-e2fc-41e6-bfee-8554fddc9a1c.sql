-- Add permissions JSONB column to team_members
ALTER TABLE public.team_members 
ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{
  "escalas_servicos": true,
  "escalas_emult": true,
  "profissionais": true,
  "unidades": true,
  "folgas": true,
  "relatorios": true,
  "publicar": true,
  "configuracoes": false,
  "gerenciar_membros": false
}'::jsonb;

-- Add team_id column to team_members for team-based queries
ALTER TABLE public.team_members
ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;

-- Function to get member permissions
CREATE OR REPLACE FUNCTION public.get_member_permissions(_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.teams t 
        WHERE t.created_by = _user_id
      ) THEN '{
        "escalas_servicos": true,
        "escalas_emult": true,
        "profissionais": true,
        "unidades": true,
        "folgas": true,
        "relatorios": true,
        "publicar": true,
        "configuracoes": true,
        "gerenciar_membros": true,
        "is_owner": true
      }'::jsonb
      WHEN EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.member_id = _user_id AND tm.status = 'accepted'
      ) THEN (
        SELECT tm.permissions || '{"is_owner": false}'::jsonb
        FROM public.team_members tm
        WHERE tm.member_id = _user_id AND tm.status = 'accepted'
        LIMIT 1
      )
      ELSE NULL
    END
$$;