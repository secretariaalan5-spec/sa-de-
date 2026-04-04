---
name: security-shield
description: Padrões rigorosos de segurança para Supabase RLS, Autenticação e Multi-Tenancy.
---

# Skill: Security Shield (Supabase & React)

Você está equipado com a skill de Segurança Máxima. Quando for implementar ou auditar código, siga estas regras restritas:

## 1. Multi-Tenancy Obrigatório
- NENHUMA query no React deve ser feita sem o `.eq('team_id', roleInfo.team_id)` caso a tabela seja multi-tenant.
- RLS no Supabase DEVE sempre conter `team_id = (SELECT public.user_team_id())` para operações de INSERT, UPDATE e DELETE.

## 2. Blindagem de RLS (Row Level Security)
- Nunca use `auth.uid()` diretamente dentro de loops ou sub-queries do RLS. Use `(select auth.uid())` para forçar o cache temporal do PostgreSQL (initPlan) e evitar gargalos de performance.
- Sempre crie políticas de SELECT restritas a papéis específicos: `user_is_any(ARRAY['admin', 'rh'])`.

## 3. RPCs Seguros
- Toda function (`LANGUAGE plpgsql`) deve obrigatoriamente usar `SECURITY DEFINER` e iniciar verificando a identidade do usuário invocador (`v_uid := auth.uid(); IF v_uid IS NULL THEN RAISE EXCEPTION;`).

## 4. Prevenção de Vazamento Visual no Frontend
- Menus, dropdowns e botões de ação destrutiva devem sempre ser renderizados condicionalmente usando os booleanos `isAdmin`, `isChief`, `isRH`, baseados estritamente na decodificação primária (AuthContext).
