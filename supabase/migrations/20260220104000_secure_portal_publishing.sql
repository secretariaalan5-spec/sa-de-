-- Add RLS policy for inserting into portal_schedules
-- Ensures only the owner can publish to their own slot

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'portal_schedules') THEN
        -- Add insert policy
        IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'portal_schedules' AND policyname = 'Admins can insert their own schedules') THEN
            CREATE POLICY "Admins can insert their own schedules" ON public.portal_schedules
                FOR INSERT WITH CHECK (auth.uid() = user_id);
        END IF;

        -- Update SELECT policy to be a bit more specific (optional but good)
        -- Keep it simple as requested for public sharing
    END IF;
END $$;
