-- Drop duplicate triggers (keep only one of each)
DROP TRIGGER IF EXISTS trg_on_extra_schedule_insert ON public.schedules;
DROP TRIGGER IF EXISTS trg_on_leave_approved ON public.leave_requests;

-- Now we have only:
-- trg_extra_schedule_credits on schedules
-- trg_leave_approved_deduct on leave_requests