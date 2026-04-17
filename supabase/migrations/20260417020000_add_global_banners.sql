-- =============================================
-- MIGRATION: Suporte a Banners Globais
-- Data: 2026-04-17
-- =============================================
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS is_global_banner boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'info';
