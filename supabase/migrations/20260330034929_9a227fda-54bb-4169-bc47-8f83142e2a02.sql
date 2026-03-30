
-- 1. RECREATE ALL MISSING TRIGGERS

-- Trigger: auto-create profile on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger: auto-credit +2 on extra schedule insert
CREATE OR REPLACE TRIGGER trg_on_extra_schedule_insert
  AFTER INSERT ON public.schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.on_extra_schedule_insert();

-- Trigger: auto-debit on leave approval
CREATE OR REPLACE TRIGGER trg_on_leave_approved
  AFTER UPDATE ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.on_leave_approved();

-- 2. FIX: Allow unit_managers to UPDATE employees in their unit
DROP POLICY IF EXISTS "Admins and chiefs can update employees" ON public.employees;

CREATE POLICY "Role-based update employees"
  ON public.employees
  FOR UPDATE
  TO authenticated
  USING (
    user_is_any(ARRAY['admin', 'category_chief'])
    OR (user_is('unit_manager') AND unit_id = user_unit_id())
  );
