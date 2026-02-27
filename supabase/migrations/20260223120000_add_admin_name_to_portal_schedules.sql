-- Adiciona a coluna admin_name para mostrar quem publicou a escala no portal
-- Execute este SQL no SQL Editor do Supabase se desejar ver o nome do administrador no portal.

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'portal_schedules') THEN
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'portal_schedules' AND column_name = 'admin_name') THEN
            ALTER TABLE public.portal_schedules ADD COLUMN admin_name TEXT;
        END IF;
    END IF;
END $$;
