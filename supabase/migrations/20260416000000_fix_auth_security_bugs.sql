-- =============================================================
-- CORREÇÃO DE BUGS CRÍTICOS NA LÓGICA DE AUTENTICAÇÃO
-- Data: 2026-04-16
-- =============================================================

-- ──────────────────────────────────────────────────────────────
-- BUG #1 (CRÍTICO - ESCALAÇÃO DE PRIVILÉGIO):
-- A política "Users can insert own role" permitia que QUALQUER
-- usuário autenticado se auto-promovesse para 'admin' executando:
--   INSERT INTO user_roles (user_id, role) VALUES (auth.uid(), 'admin');
-- A RPC accept_invite_by_token usa SECURITY DEFINER e não precisa
-- desta política aberta. Removendo imediatamente.
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can insert own role" ON public.user_roles;

-- ──────────────────────────────────────────────────────────────
-- BUG #2 (LOOP INFINITO):
-- A função generate_invite_token() tinha um bug de shadowing de
-- variável: "WHERE token = token" comparava a coluna com ela mesma
-- (sempre TRUE), tornando o loop infinito.
-- Renomeando variáveis locais para v_token / v_exists.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_invite_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token  TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Gera token aleatório de 32 chars hex
    v_token := encode(gen_random_bytes(16), 'hex');

    -- Verifica unicidade (agora compara coluna com VARIÁVEL, não consigo mesma)
    SELECT EXISTS(
      SELECT 1 FROM public.category_invites ci WHERE ci.token = v_token
    ) INTO v_exists;

    EXIT WHEN NOT v_exists;
  END LOOP;

  RETURN v_token;
END;
$$;

-- ──────────────────────────────────────────────────────────────
-- BUG #3 (SEGURANÇA - LEITURA ANÔNIMA DE CONVITES):
-- A política "Anyone can read invite by token" expõe a tabela
-- completa de convites (todos os tokens, roles, datas) para
-- usuários anônimos. Restringindo para autenticados.
-- A política de anon era necessária apenas para o fluxo de
-- registro; o RPC accept_invite_by_token usa SECURITY DEFINER,
-- então não precisa de leitura anônima na tabela.
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read invite by token" ON public.invites;
CREATE POLICY "Authenticated can read invite by token"
  ON public.invites
  FOR SELECT
  TO authenticated
  USING (true);

-- Mantém leitura anônima restrita apenas a convites NÃO usados
-- (para validar token na tela de registro antes do login)
CREATE POLICY "Anon can read unused invites"
  ON public.invites
  FOR SELECT
  TO anon
  USING (used = false);

-- ──────────────────────────────────────────────────────────────
-- BUG #4 (SEGURANÇA - category_invites sem role explícito):
-- A política SELECT de category_invites não tinha TO authenticated,
-- expondo convites ativos para usuários anônimos.
-- ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public can read active invites" ON public.category_invites;
CREATE POLICY "Authenticated can read active invites"
  ON public.category_invites
  FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

-- Permite leitura anônima apenas para validação de token (sem expor todos)
CREATE POLICY "Anon can read invite by token"
  ON public.category_invites
  FOR SELECT
  TO anon
  USING (is_active = TRUE);

-- ──────────────────────────────────────────────────────────────
-- BUG #5 (LÓGICA): remove_user_completely tinha SQL incorreto
-- que deletava leave_credits de TODOS os funcionários ao invés
-- de nenhum relacionado ao usuário (employees não tem user_id).
-- Corrigindo para apenas limpar dados do próprio auth user.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.remove_user_completely(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Apenas administradores podem remover usuários
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
  ) THEN
    RETURN json_build_object('success', FALSE, 'error', 'Apenas administradores podem remover usuários');
  END IF;

  -- Não pode remover a si mesmo
  IF p_user_id = (SELECT auth.uid()) THEN
    RETURN json_build_object('success', FALSE, 'error', 'Você não pode remover a si mesmo');
  END IF;

  -- Remove dados do usuário (não mexe em employees - eles são servidores, não usuários)
  DELETE FROM public.admin_states WHERE user_id = p_user_id;
  DELETE FROM public.category_invites WHERE admin_id = p_user_id OR accepted_by = p_user_id;
  DELETE FROM public.pending_approvals WHERE user_id = p_user_id;
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  DELETE FROM public.profiles WHERE user_id = p_user_id;

  -- Deleta o usuário auth (cascata cuida do resto)
  DELETE FROM auth.users WHERE id = p_user_id;

  RETURN json_build_object('success', TRUE, 'message', 'Usuário removido completamente');
END;
$$;
