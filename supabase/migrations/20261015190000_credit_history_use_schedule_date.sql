-- Créditos de escalas extras passam a ser registrados no histórico com a data da escala (não a data de geração).
CREATE OR REPLACE FUNCTION public.on_extra_schedule_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.type = 'extra' AND NEW.date < CURRENT_DATE AND NEW.credit_amount > 0 THEN
    INSERT INTO public.leave_credits (team_id, employee_id, amount, origin, reference_id, created_at)
    VALUES (NEW.team_id, NEW.employee_id, NEW.credit_amount, 'extra_shift', NEW.id, (NEW.date + time '12:00') AT TIME ZONE 'America/Sao_Paulo')
    ON CONFLICT (reference_id, employee_id, origin) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_pending_extra_credits()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE credited_count integer := 0;
BEGIN
  INSERT INTO public.leave_credits (team_id, employee_id, amount, origin, reference_id, created_at)
  SELECT s.team_id, s.employee_id, s.credit_amount, 'extra_shift', s.id, (s.date + time '12:00') AT TIME ZONE 'America/Sao_Paulo'
  FROM public.schedules s
  WHERE s.type = 'extra' AND s.date < CURRENT_DATE AND s.credit_amount > 0
    AND NOT EXISTS (SELECT 1 FROM public.leave_credits lc WHERE lc.reference_id = s.id AND lc.employee_id = s.employee_id AND lc.origin = 'extra_shift')
  ON CONFLICT (reference_id, employee_id, origin) DO NOTHING;
  GET DIAGNOSTICS credited_count = ROW_COUNT;
  RETURN credited_count;
END;
$$;

UPDATE public.leave_credits lc SET created_at = (s.date + time '12:00') AT TIME ZONE 'America/Sao_Paulo'
FROM public.schedules s WHERE lc.reference_id = s.id AND lc.origin = 'extra_shift';
