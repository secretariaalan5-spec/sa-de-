-- =============================================
-- MIGRATION: Dynamic Credits System + Holidays
-- 
-- Changes:
-- 1. Add shift_type and credit_amount columns to schedules
-- 2. Change leave_credits.amount from integer to numeric(5,1)
-- 3. Create holidays table
-- 4. Update triggers for dynamic credit calculation
-- =============================================

-- =============================================
-- 1. ALTER SCHEDULES: Add shift_type and credit_amount
-- =============================================
ALTER TABLE public.schedules 
  ADD COLUMN IF NOT EXISTS shift_type text NOT NULL DEFAULT 'full';

ALTER TABLE public.schedules 
  ADD COLUMN IF NOT EXISTS credit_amount numeric(5,1) NOT NULL DEFAULT 0;

-- Retrocompatibility: existing extra schedules had hardcoded +2
UPDATE public.schedules SET credit_amount = 2 WHERE type = 'extra';

-- =============================================
-- 2. ALTER LEAVE_CREDITS: integer -> numeric for fractional credits (0.5)
-- =============================================
ALTER TABLE public.leave_credits 
  ALTER COLUMN amount TYPE numeric(5,1) USING amount::numeric(5,1);

-- =============================================
-- 3. CREATE HOLIDAYS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(team_id, date)
);
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- All authenticated team members can read holidays
CREATE POLICY "Team members can read holidays" ON public.holidays 
  FOR SELECT TO authenticated USING (true);

-- Only admins can manage holidays
CREATE POLICY "Admins can manage holidays" ON public.holidays 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

CREATE POLICY "Admins can update holidays" ON public.holidays 
  FOR UPDATE TO authenticated 
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

CREATE POLICY "Admins can delete holidays" ON public.holidays 
  FOR DELETE TO authenticated 
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_holidays_team_date ON public.holidays(team_id, date);

-- =============================================
-- 4. TRIGGER: Calculate credit_amount dynamically BEFORE INSERT
-- 
-- Rules:
--   Weekend (Sat/Sun) or Holiday:
--     Full shift = 2 credits
--     Half shift = 1 credit
--   Weekday (Mon-Fri, not holiday):
--     Full shift = 1 credit
--     Half shift = 0.5 credits
-- =============================================
DROP TRIGGER IF EXISTS trg_extra_schedule_insert ON public.schedules;
DROP TRIGGER IF EXISTS trg_extra_schedule_credits ON public.schedules;
DROP TRIGGER IF EXISTS trg_extra_schedule_before_insert ON public.schedules;

CREATE OR REPLACE FUNCTION public.on_extra_schedule_calculate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  day_of_week integer;
  is_holiday boolean;
  base_credits numeric(5,1);
  final_credits numeric(5,1);
BEGIN
  IF NEW.type = 'extra' THEN
    -- Get day of week (0=Sunday, 6=Saturday)
    day_of_week := EXTRACT(DOW FROM NEW.date);
    
    -- Check if the date is a registered holiday for this team
    is_holiday := EXISTS (
      SELECT 1 FROM public.holidays h 
      WHERE h.team_id = NEW.team_id AND h.date = NEW.date
    );
    
    -- Calculate base credits
    IF day_of_week IN (0, 6) OR is_holiday THEN
      base_credits := 2; -- Weekend or holiday → 2 credits
    ELSE
      base_credits := 1; -- Regular weekday → 1 credit
    END IF;
    
    -- Apply half shift modifier
    IF NEW.shift_type = 'half' THEN
      final_credits := base_credits / 2;
    ELSE
      final_credits := base_credits;
    END IF;
    
    NEW.credit_amount := final_credits;
  ELSE
    NEW.credit_amount := 0;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_extra_schedule_before_insert
  BEFORE INSERT ON public.schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.on_extra_schedule_calculate();

-- =============================================
-- 5. TRIGGER: Grant credit AFTER INSERT (only for past dates)
-- =============================================
CREATE OR REPLACE FUNCTION public.on_extra_schedule_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.type = 'extra' AND NEW.date < CURRENT_DATE AND NEW.credit_amount > 0 THEN
    INSERT INTO public.leave_credits (team_id, employee_id, amount, origin, reference_id)
    VALUES (NEW.team_id, NEW.employee_id, NEW.credit_amount, 'extra_shift', NEW.id)
    ON CONFLICT (reference_id, employee_id, origin) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_extra_schedule_after_insert
  AFTER INSERT ON public.schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.on_extra_schedule_insert();

-- =============================================
-- 6. UPDATE grant_pending_extra_credits to use credit_amount
-- =============================================
CREATE OR REPLACE FUNCTION public.grant_pending_extra_credits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  credited_count integer := 0;
BEGIN
  INSERT INTO public.leave_credits (team_id, employee_id, amount, origin, reference_id)
  SELECT s.team_id, s.employee_id, s.credit_amount, 'extra_shift', s.id
  FROM public.schedules s
  WHERE s.type = 'extra'
    AND s.date < CURRENT_DATE
    AND s.credit_amount > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.leave_credits lc
      WHERE lc.reference_id = s.id AND lc.employee_id = s.employee_id AND lc.origin = 'extra_shift'
    )
  ON CONFLICT (reference_id, employee_id, origin) DO NOTHING;
  GET DIAGNOSTICS credited_count = ROW_COUNT;
  RETURN credited_count;
END;
$$;

-- =============================================
-- 7. UPDATE on_schedule_delete to work with numeric
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
BEGIN
  -- Check if this schedule generated credits
  SELECT COALESCE(amount, 0) INTO del_credit_amount
  FROM public.leave_credits
  WHERE reference_id = OLD.id AND employee_id = OLD.employee_id AND origin = 'extra_shift';
  
  IF del_credit_amount > 0 THEN
    -- Check if removing these credits would make balance negative
    SELECT COALESCE(SUM(amount), 0) INTO current_balance
    FROM public.leave_credits
    WHERE employee_id = OLD.employee_id;
    
    IF (current_balance - del_credit_amount) < 0 THEN
      RAISE EXCEPTION 'Não é possível apagar esta escala: o saldo de folgas do profissional ficaria negativo (atual: %, removendo: %). Cancele as folgas aprovadas antes.', current_balance, del_credit_amount;
    END IF;
  END IF;

  -- Safe to delete credits
  DELETE FROM public.leave_credits
  WHERE reference_id = OLD.id AND employee_id = OLD.employee_id AND origin = 'extra_shift';
  RETURN OLD;
END;
$function$;

-- Keep existing delete trigger
DROP TRIGGER IF EXISTS trg_schedule_delete ON public.schedules;
CREATE TRIGGER trg_schedule_delete
  AFTER DELETE ON public.schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.on_schedule_delete();

-- =============================================
-- 8. SEED: Brazilian National Holidays for 2026
-- (Team-specific: will be inserted via UI, but provide default function)
-- =============================================
-- Note: Holidays are team-specific. Admins add them via the UI.
-- No automatic seeding here - each team manages their own holidays.
