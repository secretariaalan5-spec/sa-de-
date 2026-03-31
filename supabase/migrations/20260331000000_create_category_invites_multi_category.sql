-- =====================================================
-- TABELA: category_invites
-- Convites para Chefes de Categoria com múltiplas categorias
-- Link único com token seguro
-- =====================================================

CREATE TABLE IF NOT EXISTS public.category_invites (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token           TEXT NOT NULL UNIQUE,                    -- Token único para o link
  admin_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_ids    UUID[] NOT NULL,                         -- Array de categorias
  label           TEXT NOT NULL DEFAULT '',                -- Nome personalizado (ex: "Turma A")
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  uses_count      INTEGER NOT NULL DEFAULT 0,              -- Quantas vezes foi usado
  max_uses        INTEGER DEFAULT 1,                       -- Padrão: uso único
  expires_at      TIMESTAMP WITH TIME ZONE,                -- NULL = nunca expira
  accepted_by     UUID REFERENCES auth.users(id),          -- Usuário que aceitou
  accepted_at     TIMESTAMP WITH TIME ZONE,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_category_invites_token      ON public.category_invites(token);
CREATE INDEX IF NOT EXISTS idx_category_invites_admin_id   ON public.category_invites(admin_id);
CREATE INDEX IF NOT EXISTS idx_category_invites_active     ON public.category_invites(is_active);
CREATE INDEX IF NOT EXISTS idx_category_invites_accepted   ON public.category_invites(accepted_by);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_category_invites_updated_at
  BEFORE UPDATE ON public.category_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ── Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE public.category_invites ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa autenticada pode LER convites ativos (necessário para validar token)
DROP POLICY IF EXISTS "Public can read active invites" ON public.category_invites;
CREATE POLICY "Public can read active invites"
  ON public.category_invites
  FOR SELECT
  USING (is_active = TRUE);

-- Apenas administradores podem CRIAR convites
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

-- Apenas administradores podem ATUALIZAR seus convites
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

-- Apenas administradores podem DELETAR seus convites
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

-- Usuários podem aceitar convite (atualizar accepted_by e accepted_at)
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

-- =====================================================
-- FUNÇÃO: Gerar token único seguro
-- =====================================================

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
    -- Gera token aleatório de 32 caracteres
    token := encode(gen_random_bytes(16), 'hex');
    
    -- Verifica se já existe
    SELECT EXISTS(SELECT 1 FROM public.category_invites WHERE token = token) INTO exists;
    
    EXIT WHEN NOT exists;
  END LOOP;
  
  RETURN token;
END;
$$;

-- =====================================================
-- FUNÇÃO: Aceitar convite e atribuir categorias
-- =====================================================

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
  -- Verifica se o usuário está autenticado
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Usuário não autenticado');
  END IF;
  
  v_user_id := auth.uid();
  
  -- Busca o convite
  SELECT * INTO v_invite
  FROM public.category_invites
  WHERE token = p_token
    AND is_active = TRUE
    AND accepted_by IS NULL
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR uses_count < max_uses);
  
  -- Verifica se o convite existe e é válido
  IF v_invite.id IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Convite inválido, expirado ou já utilizado');
  END IF;
  
  -- Atribui role de category_chief para cada categoria
  FOREACH v_category_id IN ARRAY v_invite.category_ids
  LOOP
    INSERT INTO public.user_roles (user_id, role, category_id)
    VALUES (v_user_id, 'category_chief', v_category_id)
    ON CONFLICT (user_id, role, category_id) DO NOTHING;
  END LOOP;
  
  -- Atualiza o convite
  UPDATE public.category_invites
  SET 
    accepted_by = v_user_id,
    accepted_at = NOW(),
    uses_count = uses_count + 1,
    is_active = CASE WHEN max_uses IS NOT NULL AND uses_count + 1 >= max_uses THEN FALSE ELSE is_active END
  WHERE id = v_invite.id;
  
  -- Retorna sucesso
  RETURN json_build_object(
    'success', TRUE,
    'message', 'Convite aceito com sucesso!',
    'categories_count', array_length(v_invite.category_ids, 1)
  );
END;
$$;

-- =====================================================
-- COMENTÁRIOS
-- =====================================================

COMMENT ON TABLE public.category_invites IS 'Convites para Chefes de Categoria com suporte a múltiplas categorias';
COMMENT ON COLUMN public.category_invites.token IS 'Token único para link de aceite';
COMMENT ON COLUMN public.category_invites.category_ids IS 'Array de IDs das categorias atribuídas';
COMMENT ON COLUMN public.category_invites.max_uses IS 'Número máximo de usos (NULL = ilimitado)';
COMMENT ON COLUMN public.category_invites.accepted_by IS 'Usuário que aceitou o convite';
