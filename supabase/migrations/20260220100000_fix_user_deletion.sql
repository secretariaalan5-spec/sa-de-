-- Migration to fix user deletion error and ensure tables exist
-- This script is defensive and checks for table/column existence before acting

DO $$
BEGIN
    -- 1. Handling portal_schedules
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'portal_schedules') THEN
        -- Add user_id column if it doesn't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'portal_schedules' AND column_name = 'user_id') THEN
            ALTER TABLE public.portal_schedules ADD COLUMN user_id UUID REFERENCES auth.users(id);
        END IF;

        -- Re-add the constraint with ON DELETE CASCADE
        -- We drop it first to ensure we are updating the rule
        BEGIN
            ALTER TABLE public.portal_schedules DROP CONSTRAINT IF EXISTS portal_schedules_user_id_fkey;
        EXCEPTION
            WHEN undefined_object THEN NULL;
        END;

        ALTER TABLE public.portal_schedules 
        ADD CONSTRAINT portal_schedules_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 2. Handling admin_states
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_states') THEN
        -- Create the table if it's missing (the app code expects it)
        CREATE TABLE public.admin_states (
            user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            emult_state JSONB DEFAULT '{}',
            service_state JSONB DEFAULT '{}',
            portal_codes JSONB DEFAULT '{}',
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        -- Enable RLS
        ALTER TABLE public.admin_states ENABLE ROW LEVEL SECURITY;

        -- Create RLS Policy
        IF NOT EXISTS (SELECT FROM pg_policies WHERE tablename = 'admin_states' AND policyname = 'Users can manage their own state') THEN
            CREATE POLICY "Users can manage their own state" ON public.admin_states
                FOR ALL USING (auth.uid() = user_id);
        END IF;
    ELSE
        -- If it exists, just update the constraint to CASCADE
        BEGIN
            ALTER TABLE public.admin_states DROP CONSTRAINT IF EXISTS admin_states_user_id_fkey;
        EXCEPTION
            WHEN undefined_object THEN NULL;
        END;

        ALTER TABLE public.admin_states 
        ADD CONSTRAINT admin_states_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

