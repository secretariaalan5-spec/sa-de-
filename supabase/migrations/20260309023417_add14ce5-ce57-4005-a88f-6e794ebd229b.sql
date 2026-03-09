
-- Adicionar coluna function_name ao professional_users para profissionais eMult
ALTER TABLE public.professional_users ADD COLUMN function_name text DEFAULT NULL;

-- Atualizar a RPC para aceitar function_name
CREATE OR REPLACE FUNCTION public.register_professional_via_portal(
  _team_id uuid, _category text, _full_name text, _email text, _function_name text DEFAULT NULL
)
RETURNS professional_users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _existing_id uuid;
  _result public.professional_users;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF _team_id IS NULL THEN
    RAISE EXCEPTION 'Team is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.teams t WHERE t.id = _team_id) THEN
    RAISE EXCEPTION 'Invalid team';
  END IF;

  UPDATE public.profiles
  SET
    team_id = _team_id,
    display_name = COALESCE(NULLIF(_full_name, ''), display_name),
    updated_at = now()
  WHERE user_id = _uid;

  SELECT id INTO _existing_id
  FROM public.professional_users
  WHERE user_id = _uid
  LIMIT 1;

  IF _existing_id IS NULL THEN
    INSERT INTO public.professional_users (
      user_id, email, full_name, team_id, category, status, professional_id, function_name
    )
    VALUES (
      _uid,
      COALESCE(NULLIF(_email, ''), ''),
      COALESCE(NULLIF(_full_name, ''), ''),
      _team_id,
      COALESCE(NULLIF(_category, ''), 'tech'),
      'pending',
      NULL,
      _function_name
    )
    RETURNING * INTO _result;
  ELSE
    UPDATE public.professional_users
    SET
      email = COALESCE(NULLIF(_email, ''), email),
      full_name = COALESCE(NULLIF(_full_name, ''), full_name),
      team_id = _team_id,
      category = COALESCE(NULLIF(_category, ''), category),
      status = 'pending',
      professional_id = NULL,
      function_name = _function_name,
      updated_at = now()
    WHERE id = _existing_id
    RETURNING * INTO _result;
  END IF;

  RETURN _result;
END;
$$;
