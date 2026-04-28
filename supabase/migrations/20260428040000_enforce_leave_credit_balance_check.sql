-- =====================================================
-- SECURITY: Enforce credit balance check on leave requests
-- Prevents requesting more leave days than available credits.
-- Applied at DB level so it cannot be bypassed from the frontend.
-- =====================================================

CREATE OR REPLACE FUNCTION public.check_leave_credit_balance()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  current_balance      numeric;
  pending_not_debited  numeric;
  available            numeric;
  days_needed          int;
BEGIN
  -- Skip check on pure status updates (approve/reject by admin)
  IF TG_OP = 'UPDATE' AND OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Only enforce for incoming pending/approved requests
  IF NEW.status NOT IN ('pending', 'approved') THEN
    RETURN NEW;
  END IF;

  days_needed := cardinality(NEW.leave_dates);
  IF days_needed = 0 THEN
    RETURN NEW;
  END IF;

  -- Total credit balance (positive = extra shifts, negative = debits from approved leave)
  SELECT COALESCE(SUM(amount), 0)
    INTO current_balance
    FROM public.leave_credits
   WHERE employee_id = NEW.employee_id;

  -- Days locked by pending requests not yet debited from leave_credits
  SELECT COALESCE(SUM(cardinality(leave_dates)), 0)
    INTO pending_not_debited
    FROM public.leave_requests
   WHERE employee_id = NEW.employee_id
     AND status = 'pending'
     AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  available := current_balance - pending_not_debited;

  IF days_needed > available THEN
    RAISE EXCEPTION
      'Saldo insuficiente: o profissional tem % crédito(s) disponível(is), mas o pedido requer % dia(s). Reduza o período ou aguarde a aprovação de pedidos pendentes.',
      available, days_needed;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger cleanly
DROP TRIGGER IF EXISTS trg_check_leave_credit_balance ON public.leave_requests;

CREATE TRIGGER trg_check_leave_credit_balance
  BEFORE INSERT OR UPDATE ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.check_leave_credit_balance();
