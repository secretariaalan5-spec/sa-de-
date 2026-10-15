-- 1. Atualizar get_team_manager_ids para incluir category_chief
CREATE OR REPLACE FUNCTION public.get_team_manager_ids(p_team_id uuid)
RETURNS TABLE(user_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT DISTINCT ur.user_id
  FROM public.user_roles ur
  WHERE ur.team_id = p_team_id
    AND ur.role IN ('admin', 'rh', 'unit_manager', 'category_chief');
END;
$function$;

-- 2. Atualizar fn_notify_new_leave_request para garantir que o chefe da categoria receba a notificação
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

  -- Notifica:
  -- - Admins e RH da equipe
  -- - Chefe(s) da categoria do profissional
  -- - Gestor(es) da unidade do profissional
  FOR v_target IN 
    SELECT DISTINCT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.team_id = NEW.team_id 
      AND (
        ur.role IN ('admin', 'rh')
        OR (ur.role = 'category_chief' AND (ur.category_id = v_category_id OR ur.category_id IS NULL))
        OR (ur.role = 'unit_manager' AND (ur.unit_id = v_unit_id OR ur.unit_id IS NULL))
      )
  LOOP
    -- Não notifica o próprio solicitante se for ele mesmo
    IF v_target.user_id <> COALESCE(NEW.requested_by, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.notifications (user_id, team_id, title, message, link, priority, type)
      VALUES (
        v_target.user_id,
        NEW.team_id,
        '📋 Nova solicitação de folga',
        v_employee_name || ' solicitou ' || NEW.days_requested || ' dia(s) de folga: ' || v_dates_text || '.' ||
          CASE WHEN NEW.is_short_notice THEN ' ⚠️ Curto prazo.' ELSE '' END,
        '/folgas',
        CASE WHEN NEW.is_short_notice THEN 'warning' ELSE 'info' END,
        'system'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- 3. Atualizar fn_notify_schedule_created para incluir category_chief
CREATE OR REPLACE FUNCTION public.fn_notify_schedule_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_employee_name TEXT;
  v_unit_name     TEXT;
  v_category_id   UUID;
  v_target        RECORD;
  v_obs_text      TEXT;
BEGIN
  -- Só notifica escalas normais
  IF NEW.type = 'extra' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(e.name, 'Profissional'), e.category_id 
  INTO v_employee_name, v_category_id
  FROM public.employees e WHERE e.id = NEW.employee_id;

  SELECT COALESCE(u.name, '') INTO v_unit_name
  FROM public.units u WHERE u.id = NEW.unit_id;

  IF NEW.observations IS NOT NULL AND NEW.observations <> '' THEN
    v_obs_text := ' | Obs: ' || NEW.observations;
  ELSE
    v_obs_text := '';
  END IF;

  -- Notifica admins, rh, gestor da unidade e chefe da categoria do profissional
  FOR v_target IN 
    SELECT DISTINCT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.team_id = NEW.team_id 
      AND (
        ur.role IN ('admin', 'rh') 
        OR (ur.role = 'unit_manager' AND (ur.unit_id = NEW.unit_id OR ur.unit_id IS NULL))
        OR (ur.role = 'category_chief' AND (ur.category_id = v_category_id OR ur.category_id IS NULL))
      )
  LOOP
    IF v_target.user_id <> COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.notifications (user_id, team_id, title, message, link, priority, type)
      VALUES (
        v_target.user_id,
        NEW.team_id,
        '📅 Nova escala registrada',
        v_employee_name || ' foi escalado(a) para ' || to_char(NEW.date::date, 'DD/MM/YYYY') ||
          CASE WHEN v_unit_name <> '' THEN ' na unidade ' || v_unit_name ELSE '' END || 
          v_obs_text || '.',
        '/escalas',
        'info',
        'system'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- 4. Atualizar fn_notify_schedule_deleted para incluir category_chief
CREATE OR REPLACE FUNCTION public.fn_notify_schedule_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_employee_name TEXT;
  v_unit_name     TEXT;
  v_category_id   UUID;
  v_target        RECORD;
BEGIN
  IF OLD.type = 'extra' THEN
    RETURN OLD;
  END IF;

  SELECT COALESCE(e.name, 'Profissional'), e.category_id 
  INTO v_employee_name, v_category_id
  FROM public.employees e WHERE e.id = OLD.employee_id;

  SELECT COALESCE(u.name, '') INTO v_unit_name
  FROM public.units u WHERE u.id = OLD.unit_id;

  -- Notifica admins, rh, gestor da unidade e chefe da categoria
  FOR v_target IN 
    SELECT DISTINCT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.team_id = OLD.team_id 
      AND (
        ur.role IN ('admin', 'rh') 
        OR (ur.role = 'unit_manager' AND (ur.unit_id = OLD.unit_id OR ur.unit_id IS NULL))
        OR (ur.role = 'category_chief' AND (ur.category_id = v_category_id OR ur.category_id IS NULL))
      )
  LOOP
    INSERT INTO public.notifications (user_id, team_id, title, message, link, priority, type)
    VALUES (
      v_target.user_id,
      OLD.team_id,
      '🗑️ Escala removida',
      'A escala de ' || v_employee_name || ' do dia ' || to_char(OLD.date::date, 'DD/MM/YYYY') ||
        CASE WHEN v_unit_name <> '' THEN ' (' || v_unit_name || ')' ELSE '' END ||
        ' foi removida.',
      '/escalas',
      'warning',
      'system'
    );
  END LOOP;

  RETURN OLD;
END;
$function$;

-- 5. Atualizar notify_leave_update para também notificar gestor da unidade e chefe da categoria quando houver decisão
CREATE OR REPLACE FUNCTION public.notify_leave_update()
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
  v_status_label  TEXT;
BEGIN
  IF NEW.status != OLD.status AND (NEW.status = 'approved' OR NEW.status = 'rejected') THEN
    SELECT COALESCE(e.name, 'Profissional'), e.category_id, e.unit_id
    INTO v_employee_name, v_category_id, v_unit_id
    FROM public.employees e WHERE e.id = NEW.employee_id;

    v_status_label := CASE WHEN NEW.status = 'approved' THEN 'aprovada' ELSE 'negada' END;

    -- Notifica quem solicitou, se for usuário autenticado
    IF NEW.requested_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, team_id, title, message, link, priority, type)
      VALUES (
        NEW.requested_by,
        NEW.team_id,
        'Folga ' || CASE WHEN NEW.status = 'approved' THEN 'Aprovada' ELSE 'Negada' END,
        'A solicitação de folga para o profissional ' || v_employee_name || ' foi ' || v_status_label || '.',
        '/folgas',
        CASE WHEN NEW.status = 'approved' THEN 'info' ELSE 'warning' END,
        'system'
      );
    END IF;

    -- Se quem decidiu não for o chefe da categoria, notifica também o chefe da categoria para manter informado
    FOR v_target IN 
      SELECT DISTINCT ur.user_id 
      FROM public.user_roles ur 
      WHERE ur.team_id = NEW.team_id 
        AND ur.role = 'category_chief' 
        AND (ur.category_id = v_category_id OR ur.category_id IS NULL)
    LOOP
      IF v_target.user_id <> COALESCE(NEW.decided_by, '00000000-0000-0000-0000-000000000000'::uuid)
         AND v_target.user_id <> COALESCE(NEW.requested_by, '00000000-0000-0000-0000-000000000000'::uuid) THEN
        INSERT INTO public.notifications (user_id, team_id, title, message, link, priority, type)
        VALUES (
          v_target.user_id,
          NEW.team_id,
          'Decisão de Folga: ' || v_employee_name,
          'A folga de ' || v_employee_name || ' foi ' || v_status_label || '.',
          '/folgas',
          'info',
          'system'
        );
      END IF;
    END LOOP;

  END IF;
  RETURN NEW;
END;
$function$;
