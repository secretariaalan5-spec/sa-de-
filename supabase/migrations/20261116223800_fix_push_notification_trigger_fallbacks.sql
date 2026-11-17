-- Migration: fix_push_notification_trigger_fallbacks
-- Corrige a trigger trigger_send_push para que envie notificações push para a nuvem
-- mesmo que as variáveis de ambiente PostgreSQL app.settings.* não estejam preenchidas,
-- garantindo que o Web Push chegue aos dispositivos quando o app/site estiver fechado.

CREATE OR REPLACE FUNCTION public.trigger_send_push()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_supabase_url TEXT;
  v_service_key  TEXT;
  v_req_id       BIGINT;
BEGIN
  -- Tenta ler de configurações do Postgres com fallback direto para a URL e anon key do projeto
  v_supabase_url := COALESCE(
    NULLIF(current_setting('app.settings.supabase_url', true), ''),
    'https://qxpqzbswtdfatdrtqhrw.supabase.co'
  );
  v_service_key  := COALESCE(
    NULLIF(current_setting('app.settings.supabase_anon_key', true), ''),
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4cHF6YnN3dGRmYXRkcnRxaHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzYwMjgsImV4cCI6MjA4NTk1MjAyOH0.BYsaBZE_3_doVSbO8D2rF4USqbZ-9_vr4dR-ILjyVlk'
  );

  -- Se for notificação sem user_id, ignora envio push direto
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Dispara requisição assíncrona para a Edge Function via pg_net
  SELECT net.http_post(
    url     := v_supabase_url || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body    := jsonb_build_object(
      'record', jsonb_build_object(
        'user_id', NEW.user_id,
        'title',   COALESCE(NEW.title, 'Saúde+'),
        'message', COALESCE(NEW.message, ''),
        'link',    COALESCE(NEW.link, '/')
      )
    )
  ) INTO v_req_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Push notification trigger error: %', SQLERRM;
  RETURN NEW;
END;
$function$;
