-- 1. Atualizar accept_category_invite para seguir o padrão visual e incluir link e categorias
CREATE OR REPLACE FUNCTION public.accept_category_invite(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invite RECORD;
  v_user_id UUID;
  v_user_email TEXT;
  v_user_name TEXT;
  v_user_avatar TEXT;
  v_team_id UUID;
  v_existing_pending RECORD;
  v_categories_text TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Usuário não autenticado');
  END IF;
  
  v_user_id := auth.uid();

  SELECT email,
         raw_user_meta_data->>'full_name',
         raw_user_meta_data->>'avatar_url'
  INTO v_user_email, v_user_name, v_user_avatar
  FROM auth.users WHERE id = v_user_id;
  
  SELECT * INTO v_invite
  FROM public.category_invites
  WHERE token = p_token
    AND is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR uses_count < max_uses)
  FOR UPDATE OF category_invites;
  
  IF v_invite.id IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Convite inválido, expirado ou já utilizado');
  END IF;

  IF v_invite.admin_id = v_user_id THEN
    RETURN json_build_object('success', FALSE, 'error', 'Você não pode usar um convite criado por você mesmo.');
  END IF;

  SELECT id, status INTO v_existing_pending
  FROM public.pending_approvals
  WHERE user_id = v_user_id AND invite_token = p_token;

  IF v_existing_pending.id IS NOT NULL THEN
    IF v_existing_pending.status = 'pending' THEN
      RETURN json_build_object('success', true, 'status', 'pending', 'message', 'Sua solicitação já está aguardando aprovação.');
    ELSIF v_existing_pending.status = 'rejected' THEN
      RETURN json_build_object('success', false, 'status', 'rejected', 'message', 'Sua solicitação foi recusada pelo administrador.');
    END IF;
  END IF;

  SELECT ur.team_id INTO v_team_id
  FROM public.user_roles ur
  WHERE ur.user_id = v_invite.admin_id AND ur.team_id IS NOT NULL
  LIMIT 1;

  INSERT INTO public.pending_approvals (
    user_id, user_email, user_name, user_avatar,
    invite_token, invite_type, requested_role,
    team_id, category_ids, status
  ) VALUES (
    v_user_id, v_user_email, v_user_name, v_user_avatar,
    p_token, 'category_invite', 'category_chief',
    v_team_id, v_invite.category_ids, 'pending'
  );

  UPDATE public.category_invites
  SET 
    accepted_by = v_user_id,
    accepted_at = NOW(),
    uses_count = uses_count + 1,
    is_active = CASE WHEN max_uses IS NOT NULL AND uses_count + 1 >= max_uses THEN FALSE ELSE is_active END
  WHERE id = v_invite.id;

  SELECT string_agg(name, ', ') INTO v_categories_text
  FROM public.categories
  WHERE id = ANY(v_invite.category_ids);

  INSERT INTO public.notifications (user_id, team_id, title, message, link, priority, type)
  SELECT ur.user_id,
         v_team_id,
         '👤 Nova solicitação de acesso',
         COALESCE(v_user_name, v_user_email) || ' solicitou acesso como Chefe de Categoria' ||
           CASE WHEN v_categories_text IS NOT NULL AND v_categories_text <> '' THEN ' (' || v_categories_text || ')' ELSE '' END || '.',
         '/convites',
         'warning',
         'system'
  FROM public.user_roles ur
  WHERE ur.role = 'admin' AND ur.team_id = v_team_id;

  RETURN json_build_object('success', true, 'status', 'pending', 'message', 'Solicitação enviada! Aguarde a aprovação do administrador.');
END;
$function$;

-- 2. Atualizar accept_invite_by_token
CREATE OR REPLACE FUNCTION public.accept_invite_by_token(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_invite RECORD;
  v_user_id UUID;
  v_user_email TEXT;
  v_user_name TEXT;
  v_user_avatar TEXT;
  v_existing_role RECORD;
  v_existing_pending RECORD;
  v_role_label TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  SELECT email, 
         raw_user_meta_data->>'full_name',
         raw_user_meta_data->>'avatar_url'
  INTO v_user_email, v_user_name, v_user_avatar
  FROM auth.users WHERE id = v_user_id;

  SELECT * INTO v_invite
  FROM public.invites
  WHERE token = p_token
    AND used = false
    AND (expires_at IS NULL OR expires_at > NOW())
  FOR UPDATE OF invites;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Convite inválido ou expirado.';
  END IF;

  IF v_invite.created_by = v_user_id THEN
    RAISE EXCEPTION 'Você não pode usar um convite criado por você mesmo.';
  END IF;

  SELECT id INTO v_existing_role
  FROM public.user_roles
  WHERE user_id = v_user_id
    AND role = v_invite.role
    AND COALESCE(unit_id, '00000000-0000-0000-0000-000000000000') = COALESCE(v_invite.unit_id, '00000000-0000-0000-0000-000000000000');

  IF v_existing_role.id IS NOT NULL THEN
    UPDATE public.invites SET used = true, used_by = v_user_id WHERE id = v_invite.id;
    RETURN json_build_object('success', true, 'status', 'already_approved', 'message', 'Você já possui este acesso.');
  END IF;

  SELECT id, status INTO v_existing_pending
  FROM public.pending_approvals
  WHERE user_id = v_user_id AND invite_token = p_token;

  IF v_existing_pending.id IS NOT NULL THEN
    IF v_existing_pending.status = 'pending' THEN
      RETURN json_build_object('success', true, 'status', 'pending', 'message', 'Sua solicitação já está aguardando aprovação.');
    ELSIF v_existing_pending.status = 'rejected' THEN
      RETURN json_build_object('success', false, 'status', 'rejected', 'message', 'Sua solicitação foi recusada pelo administrador.');
    END IF;
  END IF;

  IF v_invite.role <> 'category_chief' THEN
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_user_id AND role <> v_invite.role) THEN
      RAISE EXCEPTION 'Você já possui outro cargo no sistema.';
    END IF;
  END IF;

  INSERT INTO public.pending_approvals (
    user_id, user_email, user_name, user_avatar,
    invite_token, invite_type, requested_role,
    team_id, category_id, unit_id, status
  ) VALUES (
    v_user_id, v_user_email, v_user_name, v_user_avatar,
    p_token, 'invite', v_invite.role,
    v_invite.team_id, v_invite.category_id, v_invite.unit_id, 'pending'
  );

  UPDATE public.invites SET used = true, used_by = v_user_id WHERE id = v_invite.id;

  v_role_label := CASE v_invite.role
    WHEN 'unit_manager'   THEN 'Gerente de Unidade'
    WHEN 'category_chief' THEN 'Chefe de Categoria'
    WHEN 'rh'             THEN 'Recursos Humanos'
    WHEN 'admin'          THEN 'Administrador'
    WHEN 'professional'   THEN 'Profissional'
    ELSE v_invite.role
  END;

  INSERT INTO public.notifications (user_id, team_id, title, message, link, priority, type)
  SELECT ur.user_id,
         v_invite.team_id,
         '👤 Nova solicitação de acesso',
         COALESCE(v_user_name, v_user_email) || ' solicitou acesso como ' || v_role_label || '.',
         '/convites',
         'warning',
         'system'
  FROM public.user_roles ur
  WHERE ur.role = 'admin' AND ur.team_id = v_invite.team_id;

  RETURN json_build_object('success', true, 'status', 'pending', 'message', 'Solicitação enviada! Aguarde a aprovação do administrador.');
END;
$function$;

-- 3. Atualizar approve_pending_user
CREATE OR REPLACE FUNCTION public.approve_pending_user(p_approval_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_approval RECORD;
  v_admin_id UUID;
  v_cat_id UUID;
  v_role_label TEXT;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem aprovar solicitações.';
  END IF;

  SELECT * INTO v_approval
  FROM public.pending_approvals
  WHERE id = p_approval_id AND status = 'pending'
  FOR UPDATE;

  IF v_approval.id IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada ou já processada.';
  END IF;

  IF v_approval.invite_type = 'category_invite' THEN
    FOREACH v_cat_id IN ARRAY v_approval.category_ids
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = v_approval.user_id AND role = 'category_chief' AND category_id = v_cat_id
      ) THEN
        INSERT INTO public.user_roles (user_id, role, category_id, team_id)
        VALUES (v_approval.user_id, 'category_chief', v_cat_id, v_approval.team_id);
      END IF;
    END LOOP;
  ELSE
    INSERT INTO public.user_roles (user_id, role, team_id, category_id, unit_id)
    VALUES (v_approval.user_id, v_approval.requested_role, v_approval.team_id, v_approval.category_id, v_approval.unit_id);
  END IF;

  UPDATE public.profiles
  SET team_id = v_approval.team_id
  WHERE user_id = v_approval.user_id AND (team_id IS NULL OR team_id IS DISTINCT FROM v_approval.team_id);

  UPDATE public.pending_approvals
  SET status = 'approved', reviewed_by = v_admin_id, reviewed_at = NOW()
  WHERE id = p_approval_id;

  v_role_label := CASE v_approval.requested_role
    WHEN 'unit_manager'   THEN 'Gerente de Unidade'
    WHEN 'category_chief' THEN 'Chefe de Categoria'
    WHEN 'rh'             THEN 'Recursos Humanos'
    WHEN 'admin'          THEN 'Administrador'
    WHEN 'professional'   THEN 'Profissional'
    ELSE v_approval.requested_role
  END;

  INSERT INTO public.notifications (user_id, team_id, title, message, link, priority, type)
  VALUES (
    v_approval.user_id,
    v_approval.team_id,
    '🎉 Acesso aprovado!',
    'Seu acesso como ' || v_role_label || ' foi aprovado pelo administrador. Bem-vindo(a)!',
    '/',
    'info',
    'system'
  );

  RETURN json_build_object('success', true, 'message', 'Usuário aprovado com sucesso!');
END;
$function$;

-- 4. Atualizar reject_pending_user
CREATE OR REPLACE FUNCTION public.reject_pending_user(p_approval_id uuid, p_reason text DEFAULT NULL::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_approval RECORD;
  v_admin_id UUID;
BEGIN
  v_admin_id := auth.uid();
  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem recusar solicitações.';
  END IF;

  SELECT * INTO v_approval
  FROM public.pending_approvals
  WHERE id = p_approval_id AND status = 'pending'
  FOR UPDATE;

  IF v_approval.id IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada ou já processada.';
  END IF;

  UPDATE public.pending_approvals
  SET status = 'rejected', reviewed_by = v_admin_id, reviewed_at = NOW(), rejection_reason = p_reason
  WHERE id = p_approval_id;

  INSERT INTO public.notifications (user_id, team_id, title, message, link, priority, type)
  VALUES (
    v_approval.user_id,
    v_approval.team_id,
    '❌ Acesso recusado',
    'Sua solicitação de acesso foi recusada pelo administrador.' || CASE WHEN p_reason IS NOT NULL AND p_reason <> '' THEN ' Motivo: ' || p_reason ELSE '' END,
    '/login',
    'critical',
    'system'
  );

  RETURN json_build_object('success', true, 'message', 'Solicitação recusada.');
END;
$function$;

-- 5. Atualizar registros antigos da tabela notifications para ficarem no mesmo padrão
UPDATE public.notifications 
SET title = '👤 Nova solicitação de acesso', link = '/convites', priority = 'warning' 
WHERE title = 'Nova solicitação de acesso';

UPDATE public.notifications 
SET title = '🎉 Acesso aprovado!', link = '/', priority = 'info' 
WHERE title = 'Acesso aprovado!';

UPDATE public.notifications 
SET title = '❌ Acesso recusado', link = '/login', priority = 'critical' 
WHERE title = 'Acesso recusado';
