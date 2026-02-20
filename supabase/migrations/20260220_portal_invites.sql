-- =====================================================
-- TABELA: portal_invites
-- Convites personalizados com código e link para o portal.
-- EXECUTE NO SQL EDITOR DO SUPABASE STUDIO.
-- =====================================================

CREATE TABLE IF NOT EXISTS public.portal_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code         TEXT NOT NULL,                           -- Código único do convite (ex: EMT-A1B2C3)
  access_level TEXT NOT NULL DEFAULT 'emult'            -- 'emult' | 'nurse' | 'tech'
                CHECK (access_level IN ('emult', 'nurse', 'tech')),
  label        TEXT NOT NULL DEFAULT '',               -- Nome personalizado (ex: "Turma A")
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  uses_count   INTEGER NOT NULL DEFAULT 0,             -- Quantas vezes o convite foi usado
  max_uses     INTEGER,                                -- NULL = ilimitado
  expires_at   TIMESTAMP WITH TIME ZONE,              -- NULL = nunca expira
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (admin_id, code)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_portal_invites_admin_id  ON public.portal_invites(admin_id);
CREATE INDEX IF NOT EXISTS idx_portal_invites_code      ON public.portal_invites(code);
CREATE INDEX IF NOT EXISTS idx_portal_invites_active    ON public.portal_invites(is_active, admin_id);

-- ── Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE public.portal_invites ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa pode LER convites ativos (necessário para o portal validar o código)
DROP POLICY IF EXISTS "Public can read active invites" ON public.portal_invites;
CREATE POLICY "Public can read active invites"
  ON public.portal_invites
  FOR SELECT
  USING (TRUE);

-- Apenas o administrador dono pode CRIAR seus convites
DROP POLICY IF EXISTS "Admins can insert own invites" ON public.portal_invites;
CREATE POLICY "Admins can insert own invites"
  ON public.portal_invites
  FOR INSERT
  WITH CHECK (auth.uid() = admin_id);

-- Apenas o administrador dono pode ATUALIZAR seus convites
DROP POLICY IF EXISTS "Admins can update own invites" ON public.portal_invites;
CREATE POLICY "Admins can update own invites"
  ON public.portal_invites
  FOR UPDATE
  USING (auth.uid() = admin_id);

-- Apenas o administrador dono pode DELETAR seus convites
DROP POLICY IF EXISTS "Admins can delete own invites" ON public.portal_invites;
CREATE POLICY "Admins can delete own invites"
  ON public.portal_invites
  FOR DELETE
  USING (auth.uid() = admin_id);
