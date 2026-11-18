-- Migration: fix_notification_duplication_triggers
-- Evita duplicação de notificações no banco:
-- 1. Quando uma escala de plantão extra é criada, fn_notify_schedule_created já notifica.
--    fn_notify_credit_added não deve disparar novamente para origin = 'extra_shift'.
-- 2. Quem acabou de criar a escala não precisa receber notificação de que ele mesmo criou.

CREATE OR REPLACE FUNCTION public.fn_notify_credit_added()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_employee_name TEXT;
  v_category_id   UUID;
  v_active        BOOLEAN;
  v_origin_label  TEXT;
  v_target        RECORD;
BEGIN
  IF NEW.amount <= 0 THEN
    RETURN NEW;
  END IF;

  -- Se o crédito veio de plantão extra, a trigger fn_notify_schedule_created já notificou os gestores!
  IF NEW.origin = 'extra_shift' THEN
    RETURN NEW;
  END IF;

  SELECT e.name, e.category_id, e.active
  INTO v_employee_name, v_category_id, v_active
  FROM public.employees e WHERE e.id = NEW.employee_id;

  IF v_employee_name IS NULL OR v_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  v_origin_label := CASE NEW.origin
    WHEN 'manual'      THEN 'ajuste manual'
    WHEN 'initial'     THEN 'crédito inicial'
    ELSE 'crédito'
  END;

  FOR v_target IN 
    SELECT DISTINCT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.team_id = NEW.team_id 
      AND (
        ur.role IN ('admin', 'rh')
        OR (ur.role = 'category_chief' AND v_category_id IS NOT NULL AND ur.category_id = v_category_id)
      )
  LOOP
    INSERT INTO public.notifications (user_id, team_id, title, message, link, priority, type)
    VALUES (
      v_target.user_id,
      NEW.team_id,
      '⭐ Crédito de folga adicionado',
      v_employee_name || ' recebeu +' || NEW.amount || ' crédito(s) de folga referente a ' || v_origin_label || '.',
      '/saldo',
      'info',
      'system'
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

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
  v_creator_uid   UUID;
BEGIN
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

  v_creator_uid := COALESCE(NEW.created_by, auth.uid());
  v_creator_name := public.fn_get_user_name(v_creator_uid);

  FOR v_target IN 
    SELECT DISTINCT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.team_id = NEW.team_id 
      AND (
        ur.role IN ('admin', 'rh') 
        OR (ur.role = 'unit_manager' AND v_unit_id IS NOT NULL AND ur.unit_id = v_unit_id)
        OR (ur.role = 'category_chief' AND v_category_id IS NOT NULL AND ur.category_id = v_category_id)
      )
      -- Não notifica quem acabou de criar a escala (evita duplicidade de confirmação)
      AND (v_creator_uid IS NULL OR ur.user_id <> v_creator_uid)
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
