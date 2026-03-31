
-- Fix: credits only after the day has passed (date < CURRENT_DATE, not <=)
CREATE OR REPLACE FUNCTION public.on_extra_schedule_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.type = 'extra' AND NEW.date < CURRENT_DATE THEN
    INSERT INTO public.leave_credits (team_id, employee_id, amount, origin, reference_id)
    VALUES (NEW.team_id, NEW.employee_id, 2, 'extra_shift', NEW.id)
    ON CONFLICT (reference_id, employee_id, origin) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix grant_pending to also use strict < (day must have passed)
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
  SELECT s.team_id, s.employee_id, 2, 'extra_shift', s.id
  FROM public.schedules s
  WHERE s.type = 'extra'
    AND s.date < CURRENT_DATE
    AND NOT EXISTS (
      SELECT 1 FROM public.leave_credits lc
      WHERE lc.reference_id = s.id AND lc.employee_id = s.employee_id AND lc.origin = 'extra_shift'
    )
  ON CONFLICT (reference_id, employee_id, origin) DO NOTHING;
  GET DIAGNOSTICS credited_count = ROW_COUNT;
  RETURN credited_count;
END;
$$;

-- Create triggers if not exist
DROP TRIGGER IF EXISTS trg_extra_schedule_insert ON public.schedules;
CREATE TRIGGER trg_extra_schedule_insert
  AFTER INSERT ON public.schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.on_extra_schedule_insert();

DROP TRIGGER IF EXISTS trg_schedule_delete ON public.schedules;
CREATE TRIGGER trg_schedule_delete
  AFTER DELETE ON public.schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.on_schedule_delete();

-- Function to completely remove a user and all their data
CREATE OR REPLACE FUNCTION public.remove_user_completely(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only admins can remove users
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin') THEN
    RETURN json_build_object('success', FALSE, 'error', 'Apenas administradores podem remover usuários');
  END IF;

  -- Cannot remove yourself
  IF p_user_id = auth.uid() THEN
    RETURN json_build_object('success', FALSE, 'error', 'Você não pode remover a si mesmo');
  END IF;

  -- Delete all related data
  DELETE FROM public.leave_credits WHERE employee_id IN (SELECT id FROM public.employees WHERE id IN (SELECT id FROM public.employees));
  DELETE FROM public.admin_states WHERE user_id = p_user_id;
  DELETE FROM public.category_invites WHERE admin_id = p_user_id OR accepted_by = p_user_id;
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  DELETE FROM public.profiles WHERE user_id = p_user_id;

  -- Delete the auth user (cascades)
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN json_build_object('success', TRUE, 'message', 'Usuário removido completamente');
END;
$$;
