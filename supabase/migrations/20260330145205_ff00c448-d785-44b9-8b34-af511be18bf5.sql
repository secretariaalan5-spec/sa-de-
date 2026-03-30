
-- Delete duplicate leave_credits keeping only the first one per reference_id
DELETE FROM public.leave_credits
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY reference_id, employee_id, origin ORDER BY created_at) as rn
    FROM public.leave_credits
    WHERE reference_id IS NOT NULL
  ) sub
  WHERE rn > 1
);

-- Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_leave_credits_unique_ref 
ON public.leave_credits (reference_id, employee_id, origin) 
WHERE reference_id IS NOT NULL;

-- Also update the trigger function to use ON CONFLICT to be safe
CREATE OR REPLACE FUNCTION public.on_extra_schedule_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.type = 'extra' THEN
    INSERT INTO public.leave_credits (team_id, employee_id, amount, origin, reference_id)
    VALUES (NEW.team_id, NEW.employee_id, 2, 'extra_shift', NEW.id)
    ON CONFLICT (reference_id, employee_id, origin) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.on_leave_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status <> 'approved') THEN
    INSERT INTO public.leave_credits (team_id, employee_id, amount, origin, reference_id)
    VALUES (NEW.team_id, NEW.employee_id, -1 * NEW.days_requested, 'leave_used', NEW.id)
    ON CONFLICT (reference_id, employee_id, origin) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;
