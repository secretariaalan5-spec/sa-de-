
-- Fix search_path warnings for grant_pending_extra_credits and on_schedule_delete
CREATE OR REPLACE FUNCTION public.grant_pending_extra_credits()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  credited_count integer := 0;
BEGIN
  INSERT INTO public.leave_credits (team_id, employee_id, amount, origin, reference_id)
  SELECT s.team_id, s.employee_id, 2, 'extra_shift', s.id
  FROM public.schedules s
  WHERE s.type = 'extra'
    AND s.date <= CURRENT_DATE
    AND NOT EXISTS (
      SELECT 1 FROM public.leave_credits lc
      WHERE lc.reference_id = s.id AND lc.employee_id = s.employee_id AND lc.origin = 'extra_shift'
    )
  ON CONFLICT (reference_id, employee_id, origin) DO NOTHING;
  GET DIAGNOSTICS credited_count = ROW_COUNT;
  RETURN credited_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.on_schedule_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.leave_credits
  WHERE reference_id = OLD.id AND employee_id = OLD.employee_id AND origin = 'extra_shift';
  RETURN OLD;
END;
$function$;
