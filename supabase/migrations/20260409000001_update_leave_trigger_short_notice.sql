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
  -- Enforce minimum 10 days advance notice unless it's an explicit short notice exception
  IF NEW.is_short_notice IS NOT TRUE THEN
    min_date := CURRENT_DATE + INTERVAL '10 days';
    
    SELECT unnest INTO early_date
    FROM unnest(NEW.leave_dates) 
    WHERE unnest < min_date
    LIMIT 1;
    
    IF early_date IS NOT NULL THEN
      RAISE EXCEPTION 'Antecedência mínima de 10 dias. A data % é muito próxima (mínimo: %).', early_date, min_date;
    END IF;
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
