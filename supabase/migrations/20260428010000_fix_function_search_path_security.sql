-- =====================================================
-- SECURITY FIX: Lock search_path on all vulnerable functions
-- Prevents search_path injection attacks (CWE-426)
-- =====================================================

-- 1. user_is
CREATE OR REPLACE FUNCTION public.user_is(_role text)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid()) AND role = _role
  )
$$;

-- 2. user_is_any
CREATE OR REPLACE FUNCTION public.user_is_any(_roles text[])
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid()) AND role = ANY(_roles)
  )
$$;

-- 3. user_category_id
CREATE OR REPLACE FUNCTION public.user_category_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT category_id FROM public.user_roles
  WHERE user_id = (SELECT auth.uid()) LIMIT 1
$$;

-- 4. user_category_ids
CREATE OR REPLACE FUNCTION public.user_category_ids()
  RETURNS uuid[]
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT COALESCE(array_agg(category_id), '{}'::uuid[])
  FROM public.user_roles
  WHERE user_id = (SELECT auth.uid()) AND category_id IS NOT NULL
$$;

-- 5. user_unit_id
CREATE OR REPLACE FUNCTION public.user_unit_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT unit_id FROM public.user_roles
  WHERE user_id = (SELECT auth.uid()) LIMIT 1
$$;

-- 6. user_team_id
CREATE OR REPLACE FUNCTION public.user_team_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT team_id FROM public.user_roles
  WHERE user_id = (SELECT auth.uid()) LIMIT 1
$$;

-- 7. trigger_send_push
CREATE OR REPLACE FUNCTION public.trigger_send_push()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  supabase_url TEXT := 'https://qxpqzbswtdfatdrtqhrw.supabase.co';
  service_key  TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4cHF6YnN3dGRmYXRkcnRxaHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzYwMjgsImV4cCI6MjA4NTk1MjAyOH0.BYsaBZE_3_doVSbO8D2rF4USqbZ-9_vr4dR-ILjyVlk';
BEGIN
  PERFORM net.http_post(
    url     := supabase_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || service_key
    ),
    body    := jsonb_build_object(
      'record', jsonb_build_object(
        'user_id', NEW.user_id,
        'title',   COALESCE(NEW.title, 'Saúde+'),
        'message', COALESCE(NEW.message, ''),
        'link',    COALESCE(NEW.link, '/')
      )
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Push notification trigger error: %', SQLERRM;
  RETURN NEW;
END;
$$;
