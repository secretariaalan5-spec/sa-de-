
CREATE OR REPLACE FUNCTION public.accept_category_invite(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_user_id UUID;
  v_category_id UUID;
  v_team_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Usuário não autenticado');
  END IF;
  
  v_user_id := auth.uid();
  
  SELECT * INTO v_invite
  FROM public.category_invites
  WHERE token = p_token
    AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR uses_count < max_uses);
  
  IF v_invite.id IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Convite inválido, expirado ou já utilizado');
  END IF;

  SELECT ur.team_id INTO v_team_id
  FROM public.user_roles ur
  WHERE ur.user_id = v_invite.admin_id AND ur.team_id IS NOT NULL
  LIMIT 1;
  
  FOREACH v_category_id IN ARRAY v_invite.category_ids
  LOOP
    -- Check if already exists before inserting
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = v_user_id AND role = 'category_chief' AND category_id = v_category_id
    ) THEN
      INSERT INTO public.user_roles (user_id, role, category_id, team_id)
      VALUES (v_user_id, 'category_chief', v_category_id, v_team_id);
    END IF;
  END LOOP;

  UPDATE public.profiles
  SET team_id = v_team_id
  WHERE user_id = v_user_id AND (team_id IS NULL OR team_id IS DISTINCT FROM v_team_id);
  
  UPDATE public.category_invites
  SET 
    accepted_by = v_user_id,
    accepted_at = NOW(),
    uses_count = uses_count + 1,
    is_active = CASE WHEN max_uses IS NOT NULL AND uses_count + 1 >= max_uses THEN FALSE ELSE is_active END
  WHERE id = v_invite.id;
  
  RETURN json_build_object(
    'success', TRUE,
    'message', 'Convite aceito com sucesso!',
    'categories_count', array_length(v_invite.category_ids, 1)
  );
END;
$$;
