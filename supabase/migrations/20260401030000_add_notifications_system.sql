-- Migration: Add Notifications System
-- This migration creates the notifications table, enables RLS, and adds a trigger to notify managers about leave request updates.

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications" 
ON public.notifications FOR INSERT TO authenticated 
WITH CHECK (true);

CREATE POLICY "Users can delete their own notifications"
ON public.notifications FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
EXCEPTION
  WHEN undefined_object THEN
    -- In case the publication doesn't exist yet
    NULL;
END
$$;

-- Trigger Function (Security Definer to bypass RLS for system notifications)
CREATE OR REPLACE FUNCTION notify_leave_update()
RETURNS TRIGGER 
SECURITY DEFINER
AS $$
DECLARE
  employee_name TEXT;
BEGIN
  IF NEW.status != OLD.status AND (NEW.status = 'approved' OR NEW.status = 'rejected') AND NEW.requested_by IS NOT NULL THEN
    
    SELECT name INTO employee_name FROM public.employees WHERE id = NEW.employee_id;
    
    INSERT INTO public.notifications (user_id, team_id, title, message, link)
    VALUES (
      NEW.requested_by,
      NEW.team_id,
      'Folga ' || CASE WHEN NEW.status = 'approved' THEN 'Aprovada' ELSE 'Negada' END,
      'A solicitação de folga para o profissional ' || COALESCE(employee_name, 'Desconhecido') || ' foi ' || CASE WHEN NEW.status = 'approved' THEN 'aprovada' ELSE 'negada' END || '.',
      '/folgas'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
DROP TRIGGER IF EXISTS notify_leave_update_trigger ON public.leave_requests;
CREATE TRIGGER notify_leave_update_trigger
AFTER UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION notify_leave_update();
