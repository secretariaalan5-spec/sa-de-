-- ==========================================
-- SCRIPT DE CORREÇÃO FINAL - PORTAL ÚNICO
-- ==========================================
-- Este script garante que todas as tabelas e permissões estejam corretas.
-- EXECUTE ESTE SCRIPT NO SQL EDITOR DO SUPABASE.

DO $$
BEGIN
    -- 1. Tratar a tabela portal_schedules (Escalas Publicadas)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'portal_schedules') THEN
        
        -- Garante que user_id existe
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'portal_schedules' AND column_name = 'user_id') THEN
            ALTER TABLE public.portal_schedules ADD COLUMN user_id UUID REFERENCES auth.users(id);
        END IF;

        -- Garante que portal_codes existe para salvar os códigos da publicação
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'portal_schedules' AND column_name = 'portal_codes') THEN
            ALTER TABLE public.portal_schedules ADD COLUMN portal_codes JSONB DEFAULT '{}';
        END IF;

        -- Garante que a deleção em cascata está ativa
        ALTER TABLE public.portal_schedules DROP CONSTRAINT IF EXISTS portal_schedules_user_id_fkey;
        ALTER TABLE public.portal_schedules ADD CONSTRAINT portal_schedules_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
            
        -- Configura RLS para a tabela portal_schedules
        ALTER TABLE public.portal_schedules ENABLE ROW LEVEL SECURITY;
        
        -- Política: Qualquer um pode ver escalas publicadas (necessário para o portal público)
        DROP POLICY IF EXISTS "Public can view published schedules" ON public.portal_schedules;
        CREATE POLICY "Public can view published schedules" ON public.portal_schedules
            FOR SELECT USING (true);
            
        -- Política: Apenas o dono pode inserir/publicar suas escalas
        DROP POLICY IF EXISTS "Admins can insert their own schedules" ON public.portal_schedules;
        CREATE POLICY "Admins can insert their own schedules" ON public.portal_schedules
            FOR INSERT WITH CHECK (auth.uid() = user_id);
            
    END IF;

    -- 2. Tratar a tabela admin_states (Estado Privado do Admin)
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'admin_states') THEN
        CREATE TABLE public.admin_states (
            user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            emult_state JSONB DEFAULT '{}',
            service_state JSONB DEFAULT '{}',
            portal_codes JSONB DEFAULT '{}',
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        ALTER TABLE public.admin_states ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Users can manage their own state" ON public.admin_states FOR ALL USING (auth.uid() = user_id);
    ELSE
        -- Se já existe, garante o CASCADE na deleção
        ALTER TABLE public.admin_states DROP CONSTRAINT IF EXISTS admin_states_user_id_fkey;
        ALTER TABLE public.admin_states ADD CONSTRAINT admin_states_user_id_fkey 
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;
