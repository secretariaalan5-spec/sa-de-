-- Migration: Cancelamento de Folgas Aprovadas e Estorno Automático de Créditos
-- Permite que gestores e administradores cancelem folgas previamente aprovadas,
-- estornando automaticamente os créditos debitados e liberando as datas para novas escalas.

-- 1. Colunas de auditoria de cancelamento em leave_requests
ALTER TABLE public.leave_requests 
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- 2. Atualizar função de dedução e estorno de créditos de folga
CREATE OR REPLACE FUNCTION public.on_leave_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance integer;
BEGIN
  -- CASO 1: A folga foi APROVADA
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    -- Validação de saldo
    SELECT COALESCE(SUM(amount), 0) INTO current_balance
    FROM public.leave_credits
    WHERE employee_id = NEW.employee_id;
    
    IF current_balance < NEW.days_requested THEN
      RAISE EXCEPTION 'Saldo insuficiente (Operação abortada pela Base de Dados). Atual: %, Requisitado: %', current_balance, NEW.days_requested;
    END IF;

    -- Remove eventual duplicidade prévia por segurança
    DELETE FROM public.leave_credits 
    WHERE reference_id = NEW.id AND origin = 'leave_used';

    -- Deduz créditos
    INSERT INTO public.leave_credits (team_id, employee_id, amount, origin, reference_id)
    VALUES (NEW.team_id, NEW.employee_id, -1 * NEW.days_requested, 'leave_used', NEW.id);

  -- CASO 2: A folga estava APROVADA e foi CANCELADA ou revertida para outro status
  ELSIF OLD.status = 'approved' AND NEW.status <> 'approved' THEN
    -- Estorna créditos removendo o débito correspondente
    DELETE FROM public.leave_credits 
    WHERE reference_id = OLD.id AND origin = 'leave_used';
  END IF;

  RETURN NEW;
END;
$$;

-- Vincular a trigger atualizada
DROP TRIGGER IF EXISTS trg_leave_approved_deduct ON public.leave_requests;
DROP TRIGGER IF EXISTS trg_leave_status_change ON public.leave_requests;
CREATE TRIGGER trg_leave_status_change
AFTER UPDATE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.on_leave_status_change();

-- 3. Trigger caso o pedido de folga seja deletado diretamente
CREATE OR REPLACE FUNCTION public.on_leave_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'approved' THEN
    DELETE FROM public.leave_credits 
    WHERE reference_id = OLD.id AND origin = 'leave_used';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_leave_deleted ON public.leave_requests;
CREATE TRIGGER trg_leave_deleted
AFTER DELETE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.on_leave_deleted();

-- 4. Atualizar trigger de notificações para avisar sobre folgas canceladas
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
  v_title           TEXT;
  v_message         TEXT;
  v_actor_name      TEXT;
  v_priority        TEXT;
BEGIN
  IF NEW.status != OLD.status AND (NEW.status IN ('approved', 'rejected', 'cancelled')) THEN
    SELECT COALESCE(e.name, 'Profissional'), e.category_id, e.unit_id
    INTO v_employee_name, v_category_id, v_unit_id
    FROM public.employees e WHERE e.id = NEW.employee_id;

    v_actor_name := public.fn_get_user_name(COALESCE(NEW.cancelled_by, NEW.decided_by, auth.uid()));

    IF NEW.status = 'approved' THEN
      v_title := '✅ Folga Aprovada';
      v_message := 'A solicitação de folga para ' || v_employee_name || ' foi aprovada por ' || v_actor_name || '.';
      v_priority := 'info';
    ELSIF NEW.status = 'rejected' THEN
      v_title := '❌ Folga Recusada';
      v_message := 'A solicitação de folga para ' || v_employee_name || ' foi recusada por ' || v_actor_name || '.';
      v_priority := 'warning';
    ELSIF NEW.status = 'cancelled' THEN
      v_title := '↩️ Folga Cancelada';
      v_message := 'A folga de ' || v_employee_name || ' foi cancelada por ' || v_actor_name || '. Os créditos foram estornados e as datas liberadas.';
      v_priority := 'info';
    END IF;

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
          OR (NEW.cancelled_by IS NOT NULL AND ur.user_id = NEW.cancelled_by)
        )
    LOOP
      INSERT INTO public.notifications (user_id, team_id, title, message, link, priority, type)
      VALUES (
        v_target.user_id,
        NEW.team_id,
        v_title,
        v_message,
        '/folgas',
        v_priority,
        'system'
      );
    END LOOP;

  END IF;
  RETURN NEW;
END;
$function$;

-- 5. RPC Segura para Cancelamento de Pedido de Folga
CREATE OR REPLACE FUNCTION public.cancel_leave_request(
  p_request_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
  v_req record;
  v_emp record;
  v_is_admin boolean;
  v_is_chief boolean;
  v_is_rh boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Busca o pedido de folga
  SELECT * INTO v_req
  FROM public.leave_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Pedido de folga não encontrado.');
  END IF;

  IF v_req.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Este pedido de folga já se encontra cancelado.');
  END IF;

  -- Busca o funcionário relacionado
  SELECT * INTO v_emp
  FROM public.employees
  WHERE id = v_req.employee_id;

  -- Checagem de permissão: admin, rh ou chefe da categoria correspondente
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = v_uid AND ur.team_id = v_req.team_id AND ur.role = 'admin'
  ) INTO v_is_admin;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = v_uid AND ur.team_id = v_req.team_id AND ur.role = 'rh'
  ) INTO v_is_rh;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = v_uid 
      AND ur.team_id = v_req.team_id 
      AND ur.role = 'category_chief'
      AND v_emp.category_id IS NOT NULL
      AND ur.category_id = v_emp.category_id
  ) INTO v_is_chief;

  IF NOT (v_is_admin OR v_is_chief OR v_is_rh) THEN
    RAISE EXCEPTION 'Permissão negada: apenas administradores, RH ou chefia da categoria podem cancelar folgas.';
  END IF;

  -- Atualiza o pedido para cancelado (a trigger cuidará do estorno de créditos e notificações)
  UPDATE public.leave_requests
  SET 
    status = 'cancelled',
    cancelled_at = now(),
    cancelled_by = v_uid,
    cancellation_reason = nullif(trim(p_reason), '')
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'ok', true, 
    'message', 'Folga cancelada com sucesso! Créditos estornados e datas liberadas.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_leave_request(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_leave_request(uuid, text) TO authenticated;
