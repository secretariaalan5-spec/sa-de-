-- Add portal_codes column to portal_schedules table to store snapshots of access codes
-- This allows the portal to validate codes even if the user cannot access admin_states table

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'portal_schedules') THEN
        -- Add portal_codes column if it doesn't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'portal_schedules' AND column_name = 'portal_codes') THEN
            ALTER TABLE public.portal_schedules ADD COLUMN portal_codes JSONB DEFAULT '{}';
        END IF;
    END IF;
END $$;
