-- =============================================
-- MIGRATION: Agendamento automático de créditos de escalas extras
-- Data: 2026-04-17
-- =============================================

-- Habilita a extensão pg_cron no schema coreto se ainda não existir
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Remove qualquer agendamento com esse nome (evita duplicação ao rodar de novo)
DO $$
BEGIN
  PERFORM cron.unschedule('daily_grant_pending_extra_credits');
EXCEPTION WHEN OTHERS THEN
  -- ignora erro se não existir
END $$;

-- Cria o agendamento para rodar todo dia à meia-noite (00:00 UTC)
SELECT cron.schedule(
  'daily_grant_pending_extra_credits', 
  '0 0 * * *', 
  $$SELECT public.grant_pending_extra_credits();$$
);
