-- =============================================
-- MIGRATION: Fix schedule delete trigger for inactive employees
--
-- Problem: When an employee is deleted (set to active=false), their
-- credits are removed first. When the cascade then tries to delete
-- their schedules, the trigger fires, can't find any credits, 
-- but the balance check still blocks deletion. Also, admins
-- couldn't manually delete orphaned schedules for inactive employees.
--
-- Fix: Skip the negative balance check if the employee is inactive
-- or if the schedule's credit was already removed.
-- =============================================

CREATE OR REPLACE FUNCTION public.on_schedule_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_balance numeric(5,1);
  del_credit_amount numeric(5,1);
  emp_is_active boolean;
BEGIN
  -- Check if the employee is still active
  SELECT COALESCE(active, false) INTO emp_is_active
  FROM public.employees
  WHERE id = OLD.employee_id;

  -- Find credit linked to this specific schedule
  SELECT COALESCE(amount, 0) INTO del_credit_amount
  FROM public.leave_credits
  WHERE reference_id = OLD.id
    AND employee_id = OLD.employee_id
    AND origin = 'extra_shift';

  -- Only protect active employees from negative balance
  IF del_credit_amount > 0 AND emp_is_active IS TRUE THEN
    SELECT COALESCE(SUM(amount), 0) INTO current_balance
    FROM public.leave_credits
    WHERE employee_id = OLD.employee_id;

    IF (current_balance - del_credit_amount) < 0 THEN
      RAISE EXCEPTION 'Não é possível apagar esta escala: o saldo de folgas do profissional ficaria negativo (atual: %, removendo: %). Cancele as folgas aprovadas antes.', current_balance, del_credit_amount;
    END IF;
  END IF;

  -- Always safe to remove the credit linked to this schedule
  DELETE FROM public.leave_credits
  WHERE reference_id = OLD.id
    AND employee_id = OLD.employee_id
    AND origin = 'extra_shift';

  RETURN OLD;
END;
$function$;
