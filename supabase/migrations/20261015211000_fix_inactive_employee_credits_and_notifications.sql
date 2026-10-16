-- =========================================================================
-- Prevenir créditos e notificações para profissionais inativos ou excluídos
-- =========================================================================

-- 1. Atualizar grant_pending_extra_credits para NUNCA gerar crédito para profissional inativo ou inexistente
CREATE OR REPLACE FUNCTION public.grant_pending_extra_credits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE 
  credited_count integer := 0;
BEGIN
  INSERT INTO public.leave_credits (team_id, employee_id, amount, origin, reference_id, created_at)
  SELECT s.team_id, s.employee_id, s.credit_amount, 'extra_shift', s.id, (s.date + time '12:00') AT TIME ZONE 'America/Sao_Paulo'
  FROM public.schedules s
  JOIN public.employees e ON e.id = s.employee_id AND e.active IS TRUE
  WHERE s.type = 'extra' 
    AND s.date < CURRENT_DATE 
    AND s.credit_amount > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.leave_credits lc 
      WHERE lc.reference_id = s.id AND lc.employee_id = s.employee_id AND lc.origin = 'extra_shift'
    )
  ON CONFLICT (reference_id, employee_id, origin) DO NOTHING;

  GET DIAGNOSTICS credited_count = ROW_COUNT;
  RETURN credited_count;
END;
$function$;

-- 2. Atualizar on_extra_schedule_insert para verificar se o profissional está ativo
CREATE OR REPLACE FUNCTION public.on_extra_schedule_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.type = 'extra' AND NEW.date < CURRENT_DATE AND NEW.credit_amount > 0 THEN
    IF EXISTS (SELECT 1 FROM public.employees WHERE id = NEW.employee_id AND active IS TRUE) THEN
      INSERT INTO public.leave_credits (team_id, employee_id, amount, origin, reference_id, created_at)
      VALUES (NEW.team_id, NEW.employee_id, NEW.credit_amount, 'extra_shift', NEW.id, (NEW.date + time '12:00') AT TIME ZONE 'America/Sao_Paulo')
      ON CONFLICT (reference_id, employee_id, origin) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Atualizar fn_notify_credit_added para NUNCA notificar sobre profissionais inativos ou inexistentes
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

  -- Busca o profissional e verifica se ele ainda existe e está ativo
  SELECT e.name, e.category_id, e.active
  INTO v_employee_name, v_category_id, v_active
  FROM public.employees e WHERE e.id = NEW.employee_id;

  -- SE O PROFISSIONAL FOI REMOVIDO OU ESTÁ INATIVO, NÃO NOTIFICA NADA!
  IF v_employee_name IS NULL OR v_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  v_origin_label := CASE NEW.origin
    WHEN 'extra_shift' THEN 'plantão extra'
    WHEN 'manual'      THEN 'ajuste manual'
    WHEN 'initial'     THEN 'crédito inicial'
    ELSE 'crédito'
  END;

  -- Notifica estritamente por nível:
  -- - Admin e RH
  -- - Chefe da Categoria do profissional
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

-- 4. Trigger ao desativar ou excluir profissional para limpar dados futuros e evitar escalas órfãs
CREATE OR REPLACE FUNCTION public.fn_on_employee_deactivated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_emp_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_emp_id := OLD.id;
  ELSIF TG_OP = 'UPDATE' AND OLD.active IS TRUE AND NEW.active IS FALSE THEN
    v_emp_id := NEW.id;
  ELSE
    RETURN NEW;
  END IF;

  -- Remove todas as escalas futuras do profissional removido para não gerarem créditos
  DELETE FROM public.schedules 
  WHERE employee_id = v_emp_id AND date >= CURRENT_DATE;

  -- Remove pedidos de folga pendentes
  DELETE FROM public.leave_requests 
  WHERE employee_id = v_emp_id AND status = 'pending';

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_on_employee_deactivated ON public.employees;
CREATE TRIGGER trg_on_employee_deactivated
  AFTER UPDATE OF active OR DELETE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_on_employee_deactivated();
