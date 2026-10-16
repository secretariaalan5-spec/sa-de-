-- Corrige o erro "record 'new' has no field 'rejection_reason'" na trigger notify_leave_update
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
