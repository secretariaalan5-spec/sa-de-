-- Migration: Audit Logs Base Infrastructure
-- Setup trigger based bullet-proof audit system tracking critical data movements

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
    record_id UUID,
    actor_id UUID,
    changes JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Secure the table: Only Admins can SELECT.
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Ensure nobody can alter audit logs from client
DROP POLICY IF EXISTS "Nobody can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Nobody can update audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Nobody can delete audit logs" ON public.audit_logs;

-- Reusable trigger function
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_record_id UUID;
  v_changes JSONB;
BEGIN
  -- Assume actor is current auth user. If null, it was a systemic automated action.
  v_user_id := auth.uid();
  
  IF TG_OP = 'INSERT' THEN
    v_record_id := NEW.id;
    v_changes := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_record_id := NEW.id;
    v_changes := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    v_record_id := OLD.id;
    v_changes := to_jsonb(OLD);
  END IF;

  INSERT INTO public.audit_logs (table_name, action, record_id, actor_id, changes)
  VALUES (TG_TABLE_NAME, TG_OP, v_record_id, v_user_id, v_changes);

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to sensitive tables
-- 1. Schedules
DROP TRIGGER IF EXISTS audit_schedules ON public.schedules;
CREATE TRIGGER audit_schedules
AFTER INSERT OR UPDATE OR DELETE ON public.schedules
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 2. Leave Requests
DROP TRIGGER IF EXISTS audit_leave_requests ON public.leave_requests;
CREATE TRIGGER audit_leave_requests
AFTER INSERT OR UPDATE OR DELETE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 3. Employees
DROP TRIGGER IF EXISTS audit_employees ON public.employees;
CREATE TRIGGER audit_employees
AFTER INSERT OR UPDATE OR DELETE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 4. Teams, Categories, Units (Optional extra tracking)
DROP TRIGGER IF EXISTS audit_categories ON public.categories;
CREATE TRIGGER audit_categories
AFTER INSERT OR UPDATE OR DELETE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_units ON public.units;
CREATE TRIGGER audit_units
AFTER INSERT OR UPDATE OR DELETE ON public.units
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();
