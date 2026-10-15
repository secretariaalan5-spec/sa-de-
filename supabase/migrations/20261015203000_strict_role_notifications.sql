-- =========================================================================
-- Notificações estritas por nível de acesso:
-- - Chefe de Categoria: recebe apenas notificações referentes a profissionais da sua categoria
-- - Gerente de Unidade: recebe apenas notificações referentes a profissionais da sua unidade
-- - Admin e RH: recebem notificações gerais da equipe
-- =========================================================================

-- 1. Gatilho de Nova Solicitação de Folga estritamente por nível
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

  -- Notifica estritamente por nível:
  -- - Admins e RH: veem tudo da equipe
  -- - Chefe de Categoria: vê APENAS se o profissional for da sua categoria
  -- - Gerente de Unidade: vê APENAS se o profissional for da sua unidade
  FOR v_target IN 
    SELECT DISTINCT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.team_id = NEW.team_id 
      AND (
        ur.role IN ('admin', 'rh')
        OR (ur.role = 'category_chief' AND v_category_id IS NOT NULL AND ur.category_id = v_category_id)
        OR (ur.role = 'unit_manager' AND v_unit_id IS NOT NULL AND ur.unit_id = v_unit_id)
      )
  LOOP
    -- Não notifica quem solicitou se ele for gestor
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

-- 2. Gatilho de Decisão de Folga (Aprovada/Negada)
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
  v_icon          TEXT;
BEGIN
  IF NEW.status != OLD.status AND (NEW.status = 'approved' OR NEW.status = 'rejected') THEN
    SELECT COALESCE(e.name, 'Profissional'), e.category_id, e.unit_id
    INTO v_employee_name, v_category_id, v_unit_id
    FROM public.employees e WHERE e.id = NEW.employee_id;

    v_status_label := CASE WHEN NEW.status = 'approved' THEN 'aprovada' ELSE 'negada' END;
    v_icon := CASE WHEN NEW.status = 'approved' THEN '✅' ELSE '❌' END;

    -- Notifica o solicitante (se houver)
    IF NEW.requested_by IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, team_id, title, message, link, priority, type)
      VALUES (
        NEW.requested_by,
        NEW.team_id,
        v_icon || ' Folga ' || CASE WHEN NEW.status = 'approved' THEN 'Aprovada' ELSE 'Negada' END,
        'A solicitação de folga para ' || v_employee_name || ' foi ' || v_status_label || '.',
        '/folgas',
        CASE WHEN NEW.status = 'approved' THEN 'info' ELSE 'warning' END,
        'system'
      );
    END IF;

    -- Notifica por nível: apenas gerente da unidade do profissional e chefe da categoria do profissional
    FOR v_target IN 
      SELECT DISTINCT ur.user_id 
      FROM public.user_roles ur 
      WHERE ur.team_id = NEW.team_id 
        AND (
          ur.role IN ('admin', 'rh')
          OR (ur.role = 'category_chief' AND v_category_id IS NOT NULL AND ur.category_id = v_category_id)
          OR (ur.role = 'unit_manager' AND v_unit_id IS NOT NULL AND ur.unit_id = v_unit_id)
        )
    LOOP
      IF v_target.user_id <> COALESCE(NEW.decided_by, '00000000-0000-0000-0000-000000000000'::uuid)
         AND v_target.user_id <> COALESCE(NEW.requested_by, '00000000-0000-0000-0000-000000000000'::uuid) THEN
        INSERT INTO public.notifications (user_id, team_id, title, message, link, priority, type)
        VALUES (
          v_target.user_id,
          NEW.team_id,
          v_icon || ' Folga ' || CASE WHEN NEW.status = 'approved' THEN 'Aprovada' ELSE 'Negada' END,
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

-- 3. Gatilho de Escala Criada (Normal e Extra)
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
  v_unit_id       UUID;
  v_target        RECORD;
  v_obs_text      TEXT;
  v_title         TEXT;
  v_type_label    TEXT;
BEGIN
  -- Busca o funcionário, sua categoria e a unidade (seja da escala ou do cadastro do funcionário)
  SELECT COALESCE(e.name, 'Profissional'), e.category_id, COALESCE(NEW.unit_id, e.unit_id)
  INTO v_employee_name, v_category_id, v_unit_id
  FROM public.employees e WHERE e.id = NEW.employee_id;

  SELECT COALESCE(u.name, '') INTO v_unit_name
  FROM public.units u WHERE u.id = v_unit_id;

  IF NEW.observations IS NOT NULL AND NEW.observations <> '' THEN
    v_obs_text := ' | Obs: ' || NEW.observations;
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

  -- Notifica estritamente por nível:
  -- - Admins e RH: veem tudo da equipe
  -- - Gerente da Unidade: vê APENAS escalas da sua própria unidade
  -- - Chefe de Categoria: vê APENAS escalas de profissionais da sua categoria
  FOR v_target IN 
    SELECT DISTINCT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.team_id = NEW.team_id 
      AND (
        ur.role IN ('admin', 'rh') 
        OR (ur.role = 'unit_manager' AND v_unit_id IS NOT NULL AND ur.unit_id = v_unit_id)
        OR (ur.role = 'category_chief' AND v_category_id IS NOT NULL AND ur.category_id = v_category_id)
      )
  LOOP
    IF v_target.user_id <> COALESCE(NEW.created_by, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.notifications (user_id, team_id, title, message, link, priority, type)
      VALUES (
        v_target.user_id,
        NEW.team_id,
        v_title,
        v_employee_name || ' foi escalado(a) para ' || v_type_label || ' no dia ' || to_char(NEW.date::date, 'DD/MM/YYYY') ||
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

-- 4. Gatilho de Escala Removida (Normal e Extra)
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
  v_unit_id       UUID;
  v_target        RECORD;
BEGIN
  SELECT COALESCE(e.name, 'Profissional'), e.category_id, COALESCE(OLD.unit_id, e.unit_id)
  INTO v_employee_name, v_category_id, v_unit_id
  FROM public.employees e WHERE e.id = OLD.employee_id;

  SELECT COALESCE(u.name, '') INTO v_unit_name
  FROM public.units u WHERE u.id = v_unit_id;

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

-- 5. Gatilho de Transferência de Unidade
CREATE OR REPLACE FUNCTION public.fn_notify_transfer_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_employee_name TEXT;
  v_category_id   UUID;
  v_from_unit     TEXT;
  v_to_unit       TEXT;
  v_target        RECORD;
BEGIN
  SELECT COALESCE(e.name, 'Profissional'), e.category_id
  INTO v_employee_name, v_category_id
  FROM public.employees e WHERE e.id = NEW.employee_id;

  SELECT COALESCE(u.name, 'Unidade anterior') INTO v_from_unit
  FROM public.units u WHERE u.id = NEW.from_unit_id;

  SELECT COALESCE(u.name, 'Nova unidade') INTO v_to_unit
  FROM public.units u WHERE u.id = NEW.to_unit_id;

  -- Notifica:
  -- - Admin e RH
  -- - Gerente da Unidade de Origem (NEW.from_unit_id)
  -- - Gerente da Unidade de Destino (NEW.to_unit_id)
  -- - Chefe da Categoria do profissional
  FOR v_target IN 
    SELECT DISTINCT ur.user_id 
    FROM public.user_roles ur 
    WHERE ur.team_id = NEW.team_id 
      AND (
        ur.role IN ('admin', 'rh')
        OR (ur.role = 'unit_manager' AND ur.unit_id IN (NEW.from_unit_id, NEW.to_unit_id))
        OR (ur.role = 'category_chief' AND v_category_id IS NOT NULL AND ur.category_id = v_category_id)
      )
  LOOP
    IF v_target.user_id <> COALESCE(NEW.transferred_by, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      INSERT INTO public.notifications (user_id, team_id, title, message, link, priority, type)
      VALUES (
        v_target.user_id,
        NEW.team_id,
        '🔄 Transferência de profissional',
        v_employee_name || ' foi transferido(a) de ' || v_from_unit || ' para ' || v_to_unit || '.',
        '/transferencias',
        'info',
        'system'
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_notify_transfer_created ON public.transfer_history;
CREATE TRIGGER trg_notify_transfer_created
  AFTER INSERT ON public.transfer_history
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_transfer_created();

-- 6. Gatilho de Créditos Adicionados (Apenas Admin, RH e Chefe da Categoria)
CREATE OR REPLACE FUNCTION public.fn_notify_credit_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_employee_name TEXT;
  v_category_id   UUID;
  v_origin_label  TEXT;
  v_target        RECORD;
BEGIN
  IF NEW.amount <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(e.name, 'Profissional'), e.category_id
  INTO v_employee_name, v_category_id
  FROM public.employees e WHERE e.id = NEW.employee_id;

  v_origin_label := CASE NEW.origin
    WHEN 'extra_shift' THEN 'plantão extra'
    WHEN 'manual'      THEN 'ajuste manual'
    WHEN 'initial'     THEN 'crédito inicial'
    ELSE 'crédito'
  END;

  -- Notifica apenas Admin, RH e Chefe da Categoria (Gerentes de Unidade não recebem notificações de saldo de folga)
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
