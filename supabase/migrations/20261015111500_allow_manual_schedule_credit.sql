-- ==============================================================================
-- Allow manual credit_amount on extra schedules if explicitly specified (> 0)
-- ==============================================================================
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
    -- Se um valor manual (> 0) foi informado, respeita o valor manual
    IF NEW.credit_amount IS NOT NULL AND NEW.credit_amount > 0 THEN
      RETURN NEW;
    END IF;

    -- Caso contrário, calcula automaticamente pelas regras de feriado/fds/turno
    day_of_week := EXTRACT(DOW FROM NEW.date);
    
    is_holiday := EXISTS (
      SELECT 1 FROM public.holidays h 
      WHERE h.team_id = NEW.team_id AND h.date = NEW.date
    );
    
    IF day_of_week IN (0, 6) OR is_holiday THEN
      base_credits := 2;
    ELSE
      base_credits := 1;
    END IF;
    
    IF NEW.shift_type = 'half' THEN
      final_credits := base_credits / 2;
    ELSE
      final_credits := base_credits;
    END IF;
    
    NEW.credit_amount := final_credits;
  ELSE
    IF NEW.credit_amount IS NULL THEN
      NEW.credit_amount := 0;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
