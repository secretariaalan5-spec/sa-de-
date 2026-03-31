-- =====================================================
-- APLICAÇÃO DIRETA - SQL PARA SUPABASE STUDIO
-- Copie e cole este script no SQL Editor do Supabase
-- =====================================================

-- 1. Criar tabela category_invites
CREATE TABLE IF NOT EXISTS public.category_invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token           TEXT NOT NULL UNIQUE,
  admin_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_ids    UUID[] NOT NULL,
  label           TEXT NOT NULL DEFAULT '',
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  uses_count      INTEGER NOT NULL DEFAULT 0,
  max_uses        INTEGER DEFAULT 1,
  expires_at      TIMESTAMP WITH TIME ZONE,
  accepted_by     UUID REFERENCES auth.users(id),
  accepted_at     TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Criar índices
CREATE INDEX IF NOT EXISTS idx_category_invites_token      ON public.category_invites(token);
CREATE INDEX IF NOT EXISTS idx_category_invites_admin_id   ON public.category_invites(admin_id);
CREATE INDEX IF NOT EXISTS idx_category_invites_active     ON public.category_invites(is_active);
CREATE INDEX IF NOT EXISTS idx_category_invites_accepted   ON public.category_invites(accepted_by);

-- 3. Criar função update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Criar trigger
DROP TRIGGER IF EXISTS update_category_invites_updated_at ON public.category_invites;
CREATE TRIGGER update_category_invites_updated_at
  BEFORE UPDATE ON public.category_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Habilitar RLS
ALTER TABLE public.category_invites ENABLE ROW LEVEL SECURITY;

-- 6. Criar políticas
DROP POLICY IF EXISTS "Public can read active invites" ON public.category_invites;
CREATE POLICY "Public can read active invites"
  ON public.category_invites
  FOR SELECT
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "Admins can insert invites" ON public.category_invites;
CREATE POLICY "Admins can insert invites"
  ON public.category_invites
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update own invites" ON public.category_invites;
CREATE POLICY "Admins can update own invites"
  ON public.category_invites
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete own invites" ON public.category_invites;
CREATE POLICY "Admins can delete own invites"
  ON public.category_invites
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can accept invites" ON public.category_invites;
CREATE POLICY "Users can accept invites"
  ON public.category_invites
  FOR UPDATE
  USING (is_active = TRUE AND accepted_by IS NULL)
  WITH CHECK (
    accepted_by = auth.uid() AND
    accepted_at IS NOT NULL AND
    uses_count >= 0
  );

-- 7. Criar função generate_invite_token
DROP FUNCTION IF EXISTS public.generate_invite_token();
CREATE OR REPLACE FUNCTION public.generate_invite_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  token TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    token := encode(gen_random_bytes(16), 'hex');
    SELECT EXISTS(SELECT 1 FROM public.category_invites WHERE token = token) INTO exists;
    EXIT WHEN NOT exists;
  END LOOP;
  RETURN token;
END;
$$;

-- 8. Criar função accept_category_invite
DROP FUNCTION IF EXISTS public.accept_category_invite(TEXT);
CREATE OR REPLACE FUNCTION public.accept_category_invite(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite RECORD;
  v_user_id UUID;
  v_category_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Usuário não autenticado');
  END IF;
  
  v_user_id := auth.uid();
  
  SELECT * INTO v_invite
  FROM public.category_invites
  WHERE token = p_token
    AND is_active = TRUE
    AND accepted_by IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR uses_count < max_uses);
  
  IF v_invite.id IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Convite inválido, expirado ou já utilizado');
  END IF;
  
  FOREACH v_category_id IN ARRAY v_invite.category_ids
  LOOP
    INSERT INTO public.user_roles (user_id, role, category_id)
    VALUES (v_user_id, 'category_chief', v_category_id)
    ON CONFLICT (user_id, role, category_id) DO NOTHING;
  END LOOP;
  
  UPDATE public.category_invites
  SET 
    accepted_by = v_user_id,
    accepted_at = NOW(),
    uses_count = uses_count + 1,
    is_active = CASE WHEN max_uses IS NOT NULL AND uses_count + 1 >= max_uses THEN FALSE ELSE is_active END
  WHERE id = v_invite.id;
  
  RETURN json_build_object(
    'success', TRUE,
    'message', 'Convite aceito com sucesso!',
    'categories_count', array_length(v_invite.category_ids, 1)
  );
END;
$$;

-- 9. Comentários
COMMENT ON TABLE public.category_invites IS 'Convites para Chefes de Categoria com suporte a múltiplas categorias';
COMMENT ON COLUMN public.category_invites.token IS 'Token único para link de aceite';
COMMENT ON COLUMN public.category_invites.category_ids IS 'Array de IDs das categorias atribuídas';
COMMENT ON COLUMN public.category_invites.max_uses IS 'Número máximo de usos (NULL = ilimitado)';
COMMENT ON COLUMN public.category_invites.accepted_by IS 'Usuário que aceitou o convite';
