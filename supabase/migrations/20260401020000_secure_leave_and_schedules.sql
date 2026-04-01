-- Limpar escalas duplicadas (caso existam) devido à ausência prévia da constraint
DELETE FROM public.schedules a USING public.schedules b
WHERE a.id > b.id AND a.employee_id = b.employee_id AND a.date = b.date;

-- Proibir escalas duplicadas para o mesmo funcionário no mesmo dia
ALTER TABLE public.schedules DROP CONSTRAINT IF EXISTS uq_schedules_emp_date;
ALTER TABLE public.schedules ADD CONSTRAINT uq_schedules_emp_date UNIQUE(employee_id, date);

-- Atualização da Trigger de Saldo: Validar se o funcionário realmente tem saldo ANTES de deduzir.
CREATE OR REPLACE FUNCTION public.on_leave_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance integer;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    -- Check balance
    SELECT COALESCE(SUM(amount), 0) INTO current_balance
    FROM public.leave_credits
    WHERE employee_id = NEW.employee_id;
    
    IF current_balance < NEW.days_requested THEN
      RAISE EXCEPTION 'Saldo insuficiente (Operação abortada pela Base de Dados). Atual: %, Requisitado: %', current_balance, NEW.days_requested;
    END IF;

    -- Deduct credits
    INSERT INTO public.leave_credits (team_id, employee_id, amount, origin, reference_id)
    VALUES (NEW.team_id, NEW.employee_id, -1 * NEW.days_requested, 'leave_used', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Criar Trigger para checar Conflitos de Folga vs Escalas e outras Folgas no momento do INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.check_leave_request_conflicts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conflict_date date;
BEGIN
  -- Check contra schedules (escalas ativas)
  SELECT date INTO conflict_date
  FROM public.schedules
  WHERE employee_id = NEW.employee_id AND date = ANY(NEW.leave_dates)
  LIMIT 1;
  
  IF conflict_date IS NOT NULL THEN
    RAISE EXCEPTION 'Conflito bloqueado: O profissional já possui escala no dia %.', conflict_date;
  END IF;

  -- Check contra outras folgas aprovadas ou pendentes
  IF NEW.status IN ('pending', 'approved') THEN
    SELECT unnest(leave_dates) INTO conflict_date
    FROM public.leave_requests
    WHERE employee_id = NEW.employee_id 
      AND status IN ('pending', 'approved')
      AND id <> NEW.id 
      AND leave_dates && NEW.leave_dates
    LIMIT 1;

    IF conflict_date IS NOT NULL THEN
      RAISE EXCEPTION 'Sobreposição bloqueada: O dia % já está reservado em outro pedido de folga.', conflict_date;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_leave_conflicts ON public.leave_requests;
CREATE TRIGGER trg_check_leave_conflicts
BEFORE INSERT OR UPDATE ON public.leave_requests
FOR EACH ROW
EXECUTE FUNCTION public.check_leave_request_conflicts();

-- Criar Trigger para checar se a Escala nova conflita com uma folga já validada/pendente
CREATE OR REPLACE FUNCTION public.check_schedule_leave_conflicts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM 1 FROM public.leave_requests
  WHERE employee_id = NEW.employee_id
    AND status IN ('pending', 'approved')
    AND NEW.date = ANY(leave_dates);

  IF FOUND THEN
    RAISE EXCEPTION 'Conflito bloqueado: Profissional tem folga pendente/aprovada neste dia.';
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_schedule_conflicts ON public.schedules;
CREATE TRIGGER trg_check_schedule_conflicts
BEFORE INSERT OR UPDATE ON public.schedules
FOR EACH ROW
EXECUTE FUNCTION public.check_schedule_leave_conflicts();
