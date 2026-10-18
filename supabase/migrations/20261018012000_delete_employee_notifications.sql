-- Migration: Limpar notificações associadas ao profissional quando ele for excluído ou desativado
-- Garante que alertas órfãos de escalas, folgas, créditos ou comunicados do profissional não fiquem visíveis no sino.

CREATE OR REPLACE FUNCTION public.fn_on_employee_deactivated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_emp_id   UUID;
  v_emp_name TEXT;
  v_team_id  UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_emp_id   := OLD.id;
    v_emp_name := OLD.name;
    v_team_id  := OLD.team_id;
  ELSIF TG_OP = 'UPDATE' AND OLD.active IS TRUE AND NEW.active IS FALSE THEN
    v_emp_id   := NEW.id;
    v_emp_name := NEW.name;
    v_team_id  := NEW.team_id;
  ELSE
    RETURN NEW;
  END IF;

  -- 1. Remove todas as escalas futuras do profissional removido para não gerarem créditos
  DELETE FROM public.schedules 
  WHERE employee_id = v_emp_id AND date >= CURRENT_DATE;

  -- 2. Remove pedidos de folga pendentes
  DELETE FROM public.leave_requests 
  WHERE employee_id = v_emp_id AND status = 'pending';

  -- 3. Remove sessões e códigos de acesso do portal do profissional
  DELETE FROM public.portal_sessions WHERE employee_id = v_emp_id;
  DELETE FROM public.employee_access_codes WHERE employee_id = v_emp_id;

  -- 4. REMOVE TODAS AS NOTIFICAÇÕES que citam ou pertencem ao profissional excluído
  -- Filtra por nome do profissional nas mensagens e títulos, no mesmo time
  IF v_emp_name IS NOT NULL AND length(trim(v_emp_name)) > 0 THEN
    DELETE FROM public.notifications
    WHERE (team_id IS NULL OR team_id = v_team_id)
      AND (
        message ILIKE '%' || trim(v_emp_name) || '%'
        OR title ILIKE '%' || trim(v_emp_name) || '%'
      );
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;

-- Recria a trigger para garantir execução no UPDATE de active ou DELETE direto
DROP TRIGGER IF EXISTS trg_on_employee_deactivated ON public.employees;
CREATE TRIGGER trg_on_employee_deactivated
  AFTER UPDATE OF active OR DELETE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_on_employee_deactivated();
