-- 1. Função inteligente para obter o nome real do usuário
CREATE OR REPLACE FUNCTION public.fn_get_user_name(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_name TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 'Gestão';
  END IF;

  -- 1) Tenta display_name de profiles
  SELECT NULLIF(TRIM(display_name), '') INTO v_name
  FROM public.profiles
  WHERE user_id = p_user_id OR id = p_user_id
  LIMIT 1;

  IF v_name IS NOT NULL AND v_name <> '' THEN
    RETURN v_name;
  END IF;

  -- 2) Tenta full_name / name de auth.users metadata ou email
  SELECT COALESCE(
    NULLIF(TRIM(raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(raw_user_meta_data->>'name'), ''),
    NULLIF(TRIM(split_part(email, '@', 1)), '')
  ) INTO v_name
  FROM auth.users
  WHERE id = p_user_id;

  IF v_name IS NOT NULL AND v_name <> '' THEN
    -- Sincroniza de volta no profiles para consistência
    UPDATE public.profiles
    SET display_name = v_name
    WHERE (user_id = p_user_id OR id = p_user_id) AND (display_name IS NULL OR TRIM(display_name) = '');
    
    RETURN v_name;
  END IF;

  RETURN 'Gestão';
END;
$$;

-- 2. Atualiza os profiles existentes com nomes reais do auth.users se display_name estiver vazio
UPDATE public.profiles p
SET display_name = COALESCE(
  NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
  NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
  NULLIF(TRIM(split_part(u.email, '@', 1)), '')
)
FROM auth.users u
WHERE (p.user_id = u.id OR p.id = u.id)
  AND (p.display_name IS NULL OR TRIM(p.display_name) = '');

-- 3. Garantir created_by / requested_by automáticos caso nulos
CREATE OR REPLACE FUNCTION public.fn_schedules_set_defaults()
RETURNS trigger AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_schedules_set_defaults ON public.schedules;
CREATE TRIGGER trg_schedules_set_defaults
BEFORE INSERT ON public.schedules
FOR EACH ROW
EXECUTE FUNCTION public.fn_schedules_set_defaults();

CREATE OR REPLACE FUNCTION public.fn_leave_requests_set_defaults()
RETURNS trigger AS $$
BEGIN
  IF NEW.requested_by IS NULL THEN
    NEW.requested_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_leave_requests_set_defaults ON public.leave_requests;
CREATE TRIGGER trg_leave_requests_set_defaults
BEFORE INSERT ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.fn_leave_requests_set_defaults();

-- 4. Notificação de Nova Escala / Plantão Extra:
-- SEM texto forçado de unidade, COM o nome de quem escalou
CREATE OR REPLACE FUNCTION public.fn_notify_schedule_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_employee_name TEXT;
  v_category_id   UUID;
  v_unit_id       UUID;
  v_target        RECORD;
  v_obs_text      TEXT;
  v_title         TEXT;
  v_type_label    TEXT;
  v_creator_name  TEXT;
BEGIN
  -- Busca o funcionário e sua categoria
  SELECT COALESCE(e.name, 'Profissional'), e.category_id, COALESCE(NEW.unit_id, e.unit_id)
  INTO v_employee_name, v_category_id, v_unit_id
  FROM public.employees e WHERE e.id = NEW.employee_id;

  IF NEW.observations IS NOT NULL AND TRIM(NEW.observations) <> '' THEN
    v_obs_text := ' | Obs: ' || TRIM(NEW.observations);
  ELSE
    v_obs_text := '';
  END IF;

  IF NEW.type = 'extra' THEN
    v_title := '⭐ Plantão extra registrado';
    v_type_label := 'plantão extra';
  ELSE
    v_title := '📅 Nova escala registrada';
    v_type_label := 'escala';
  END IF;

  -- Nome de quem escalou de fato
  v_creator_name := public.fn_get_user_name(COALESCE(NEW.created_by, auth.uid()));

  -- Notifica estritamente por nível:
  -- - Admins e RH: veem tudo da equipe
  -- - Gerente da Unidade: vê se estiver na sua unidade
  -- - Chefe de Categoria: vê escalas de profissionais da sua categoria
  -- - Quem escalou: também recebe para verificação no sininho
  FOR v_target IN 
    SELECT DISTINCT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.team_id = NEW.team_id 
      AND (
        ur.role IN ('admin', 'rh') 
        OR (ur.role = 'unit_manager' AND v_unit_id IS NOT NULL AND ur.unit_id = v_unit_id)
        OR (ur.role = 'category_chief' AND v_category_id IS NOT NULL AND ur.category_id = v_category_id)
        OR (NEW.created_by IS NOT NULL AND ur.user_id = NEW.created_by)
      )
  LOOP
    INSERT INTO public.notifications (user_id, team_id, title, message, link, priority, type)
    VALUES (
      v_target.user_id,
      NEW.team_id,
      v_title,
      v_employee_name || ' foi escalado(a) por ' || v_creator_name || ' para ' || v_type_label || ' no dia ' || to_char(NEW.date::date, 'DD/MM/YYYY') || v_obs_text || '.',
      '/escalas',
      'info',
      'system'
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

-- 5. Notificação de Escala Removida:
-- SEM unidade, COM quem removeu
CREATE OR REPLACE FUNCTION public.fn_notify_schedule_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_employee_name TEXT;
  v_category_id   UUID;
  v_unit_id       UUID;
  v_target        RECORD;
  v_remover_name  TEXT;
BEGIN
  SELECT COALESCE(e.name, 'Profissional'), e.category_id, COALESCE(OLD.unit_id, e.unit_id)
  INTO v_employee_name, v_category_id, v_unit_id
  FROM public.employees e WHERE e.id = OLD.employee_id;

  v_remover_name := public.fn_get_user_name(auth.uid());

  -- Notifica estritamente por nível:
  FOR v_target IN 
    SELECT DISTINCT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.team_id = OLD.team_id 
      AND (
        ur.role IN ('admin', 'rh') 
        OR (ur.role = 'unit_manager' AND v_unit_id IS NOT NULL AND ur.unit_id = v_unit_id)
        OR (ur.role = 'category_chief' AND v_category_id IS NOT NULL AND ur.category_id = v_category_id)
      )
  LOOP
    INSERT INTO public.notifications (user_id, team_id, title, message, link, priority, type)
    VALUES (
      v_target.user_id,
      OLD.team_id,
      '🗑️ Escala removida',
      'A escala de ' || v_employee_name || ' do dia ' || to_char(OLD.date::date, 'DD/MM/YYYY') || ' foi removida por ' || v_remover_name || '.',
      '/escalas',
      'warning',
      'system'
    );
  END LOOP;

  RETURN OLD;
END;
$function$;

-- 6. Notificação de Folga Aprovada / Recusada:
-- COM o nome real de quem aprovou/recusou (sem cair em "Coordenação")
CREATE OR REPLACE FUNCTION public.notify_leave_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_employee_name   TEXT;
  v_category_id     UUID;
  v_unit_id         UUID;
  v_target          RECORD;
  v_status_label    TEXT;
  v_icon            TEXT;
  v_decided_by_name TEXT;
BEGIN
  IF NEW.status != OLD.status AND (NEW.status = 'approved' OR NEW.status = 'rejected') THEN
    SELECT COALESCE(e.name, 'Profissional'), e.category_id, e.unit_id
    INTO v_employee_name, v_category_id, v_unit_id
    FROM public.employees e WHERE e.id = NEW.employee_id;

    v_status_label := CASE WHEN NEW.status = 'approved' THEN 'aprovada' ELSE 'recusada' END;
    v_icon := CASE WHEN NEW.status = 'approved' THEN '✅' ELSE '❌' END;

    -- Nome real de quem tomou a decisão
    v_decided_by_name := public.fn_get_user_name(COALESCE(NEW.decided_by, auth.uid()));

    -- Notifica estritamente quem pertence ao escopo desta folga:
    FOR v_target IN 
      SELECT DISTINCT ur.user_id 
      FROM public.user_roles ur 
      WHERE ur.team_id = NEW.team_id 
        AND (
          ur.role IN ('admin', 'rh')
          OR (ur.role = 'category_chief' AND v_category_id IS NOT NULL AND ur.category_id = v_category_id)
          OR (ur.role = 'unit_manager' AND v_unit_id IS NOT NULL AND ur.unit_id = v_unit_id)
          OR (NEW.requested_by IS NOT NULL AND ur.user_id = NEW.requested_by)
          OR (NEW.decided_by IS NOT NULL AND ur.user_id = NEW.decided_by)
        )
    LOOP
      INSERT INTO public.notifications (user_id, team_id, title, message, link, priority, type)
      VALUES (
        v_target.user_id,
        NEW.team_id,
        v_icon || ' Folga ' || CASE WHEN NEW.status = 'approved' THEN 'Aprovada' ELSE 'Recusada' END,
        'A solicitação de folga para ' || v_employee_name || ' foi ' || v_status_label || ' por ' || v_decided_by_name || '.',
        '/folgas',
        CASE WHEN NEW.status = 'approved' THEN 'info' ELSE 'warning' END,
        'system'
      );
    END LOOP;

  END IF;
  RETURN NEW;
END;
$function$;

-- 7. Notificação de Nova Solicitação de Folga:
-- COM o nome de quem solicitou a folga
CREATE OR REPLACE FUNCTION public.fn_notify_new_leave_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_employee_name  TEXT;
  v_category_id    UUID;
  v_unit_id        UUID;
  v_dates_text     TEXT;
  v_requester_name TEXT;
  v_target         RECORD;
BEGIN
  -- Dados do profissional
  SELECT COALESCE(e.name, 'Profissional'), e.category_id, e.unit_id 
  INTO v_employee_name, v_category_id, v_unit_id
  FROM public.employees e WHERE e.id = NEW.employee_id;

  -- Formata as datas solicitadas
  IF NEW.leave_dates IS NOT NULL AND array_length(NEW.leave_dates, 1) > 0 THEN
    SELECT string_agg(
      to_char(d::date, 'DD/MM'), ', '
      ORDER BY d::date
    ) INTO v_dates_text
    FROM unnest(NEW.leave_dates) AS d;
  ELSE
    v_dates_text := 'datas não informadas';
  END IF;

  v_requester_name := public.fn_get_user_name(COALESCE(NEW.requested_by, auth.uid()));

  -- Notifica estritamente por nível:
  -- - Admins e RH: veem tudo da equipe
  -- - Chefe de Categoria: vê se o profissional for da sua categoria
  -- - Gerente de Unidade: vê se o profissional for da sua unidade
  -- - O próprio solicitante: para confirmação no sininho
  FOR v_target IN 
    SELECT DISTINCT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.team_id = NEW.team_id 
      AND (
        ur.role IN ('admin', 'rh')
        OR (ur.role = 'category_chief' AND v_category_id IS NOT NULL AND ur.category_id = v_category_id)
        OR (ur.role = 'unit_manager' AND v_unit_id IS NOT NULL AND ur.unit_id = v_unit_id)
        OR (NEW.requested_by IS NOT NULL AND ur.user_id = NEW.requested_by)
      )
  LOOP
    INSERT INTO public.notifications (user_id, team_id, title, message, link, priority, type)
    VALUES (
      v_target.user_id,
      NEW.team_id,
      '📋 Nova solicitação de folga',
      v_employee_name || ' teve ' || NEW.days_requested || ' dia(s) de folga solicitados por ' || v_requester_name || ': ' || v_dates_text || '.' ||
        CASE WHEN NEW.is_short_notice THEN ' ⚠️ Curto prazo.' ELSE '' END,
      '/folgas',
      CASE WHEN NEW.is_short_notice THEN 'warning' ELSE 'info' END,
      'system'
    );
  END LOOP;

  RETURN NEW;
END;
$function$;
