
-- Add unique constraint on leave_credits to support ON CONFLICT in trigger
CREATE UNIQUE INDEX IF NOT EXISTS leave_credits_reference_employee_origin_key 
ON public.leave_credits (reference_id, employee_id, origin);
