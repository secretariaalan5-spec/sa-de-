
-- 1. Update trigger: only grant credits if schedule date <= today
CREATE OR REPLACE FUNCTION public.on_extra_schedule_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.type = 'extra' AND NEW.date <= CURRENT_DATE THEN
    INSERT INTO public.leave_credits (team_id, employee_id, amount, origin, reference_id)
    VALUES (NEW.team_id, NEW.employee_id, 2, 'extra_shift', NEW.id)
    ON CONFLICT (reference_id, employee_id, origin) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Create trigger to return credits when schedule is deleted
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

-- 3. Create the delete trigger on schedules table
DROP TRIGGER IF EXISTS trg_schedule_delete ON public.schedules;
CREATE TRIGGER trg_schedule_delete
  BEFORE DELETE ON public.schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.on_schedule_delete();

-- 4. Ensure the insert trigger exists
DROP TRIGGER IF EXISTS trg_extra_schedule_insert ON public.schedules;
CREATE TRIGGER trg_extra_schedule_insert
  AFTER INSERT ON public.schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.on_extra_schedule_insert();

-- 5. Create a daily cron-like function to grant credits for past schedules not yet credited
-- This can be called manually or via pg_cron if available
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
