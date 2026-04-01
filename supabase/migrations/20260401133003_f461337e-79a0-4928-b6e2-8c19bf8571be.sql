
-- 1. Replace on_schedule_delete to block if balance would go negative
CREATE OR REPLACE FUNCTION public.on_schedule_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_balance integer;
  credit_amount integer;
BEGIN
  -- Check if this schedule generated credits
  SELECT COALESCE(amount, 0) INTO credit_amount
  FROM public.leave_credits
  WHERE reference_id = OLD.id AND employee_id = OLD.employee_id AND origin = 'extra_shift';
  
  IF credit_amount > 0 THEN
    -- Check if removing these credits would make balance negative
    SELECT COALESCE(SUM(amount), 0) INTO current_balance
    FROM public.leave_credits
    WHERE employee_id = OLD.employee_id;
    
    IF (current_balance - credit_amount) < 0 THEN
      RAISE EXCEPTION 'Não é possível apagar esta escala: o saldo de folgas do profissional ficaria negativo (atual: %, removendo: %). Cancele as folgas aprovadas antes.', current_balance, credit_amount;
    END IF;
  END IF;

  -- Safe to delete credits
  DELETE FROM public.leave_credits
  WHERE reference_id = OLD.id AND employee_id = OLD.employee_id AND origin = 'extra_shift';
  RETURN OLD;
END;
$function$;

-- 2. Update leave request conflict checker to enforce 10-day advance
CREATE OR REPLACE FUNCTION public.check_leave_request_conflicts()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  conflict_date date;
  min_date date;
  early_date date;
BEGIN
  -- Enforce minimum 10 days advance notice
  min_date := CURRENT_DATE + INTERVAL '10 days';
  
  SELECT unnest INTO early_date
  FROM unnest(NEW.leave_dates) 
  WHERE unnest < min_date
  LIMIT 1;
  
  IF early_date IS NOT NULL THEN
    RAISE EXCEPTION 'Antecedência mínima de 10 dias. A data % é muito próxima (mínimo: %).', early_date, min_date;
  END IF;

  -- Check contra schedules
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
$function$;
