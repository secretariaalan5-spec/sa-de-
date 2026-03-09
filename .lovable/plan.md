

# Plano de Melhorias do Sistema -- Passo a Passo

Abaixo estao listadas as melhorias organizadas por prioridade. Cada uma sera implementada individualmente, na ordem, mantendo o sistema funcional a cada passo.

---

## Lista de Melhorias (ordem de execucao)

### 1. Ativar Leaked Password Protection no Supabase
- **Problema**: Scan de seguranca detectou que a protecao contra senhas vazadas esta desabilitada.
- **Acao**: Ativar via dashboard do Supabase (Auth > Settings). Nenhuma alteracao de codigo necessaria.

### 2. Validacao de inputs no Login e no Portal (registro)
- **Problema**: Formularios de login, cadastro e registro de profissional nao validam entradas (e-mail, senha, nome).
- **Acao**: Adicionar validacao com `zod` nos formularios de `Login.tsx` (email valido, senha min 8 chars, nome min 2 chars) e no `RegistrationScreen` dentro de `Portal.tsx` (nome obrigatorio, categoria obrigatoria). Exibir mensagens de erro inline.

### 3. Adicionar pagina de Reset de Senha
- **Problema**: Nao existe pagina `/reset-password` nem link "Esqueci minha senha" no login. Usuarios nao conseguem recuperar acesso.
- **Acao**: Criar link "Esqueci minha senha" no `Login.tsx`, criar pagina `src/pages/ResetPassword.tsx` que captura o token de recovery e permite definir nova senha. Adicionar rota publica no `App.tsx`.

### 4. Refatorar Portal.tsx em componentes menores
- **Problema**: Arquivo com 1161 linhas, dificil de manter e debugar.
- **Acao**: Extrair para componentes separados:
  - `src/components/portal/PortalScheduleTab.tsx` (escala mensal/semanal)
  - `src/components/portal/PortalCreditsTab.tsx` (creditos)
  - `src/components/portal/PortalLeavesTab.tsx` (folgas)
  - `src/components/portal/PortalProfileTab.tsx` (perfil + avatar)
  - `src/components/portal/PortalShared.tsx` (GlassCard, StatPill, ActionButton, etc.)
  
  O `Portal.tsx` ficara como orquestrador, delegando renderizacao para cada componente.

### 5. Remover casts `as any` das queries Supabase
- **Problema**: Dezenas de `as any` nas chamadas ao Supabase mascaram erros de tipo e dificultam manutencao.
- **Acao**: Atualizar `src/integrations/supabase/types.ts` para refletir o schema atual (todas as tabelas: `admin_states`, `portal_schedules`, `professional_users`, `professional_leave_requests`, `profiles`, `teams`, etc.) e remover os casts `as any` dos contextos e hooks.

### 6. Proteger rota do Portal contra acesso sem team_id
- **Problema**: Se alguem acessar `/portal` sem o parametro `?team=`, o sistema carrega normalmente mas fica em estado inconsistente. O `localStorage` pode manter um `team_id` antigo.
- **Acao**: Adicionar guard no `Portal.tsx` que, apos login, verifica se ha `team_id` valido. Se nao houver, exibir tela de erro clara pedindo o link correto ao administrador, em vez de tentar registrar com dados incompletos.

### 7. Debounce na sincronizacao com Supabase
- **Problema**: Cada alteracao no `AppDataContext` e `ServiceStateContext` faz um `upsert` imediato, gerando muitas requisicoes ao clicar rapidamente.
- **Acao**: Adicionar debounce de ~1.5s no `saveToSupabase` e `saveServiceState` usando `setTimeout`/`useRef`, agrupando alteracoes rapidas em uma unica requisicao.

### 8. Adicionar loading states e feedback visual consistente
- **Problema**: Algumas acoes (aprovar profissional, publicar escala, resetar dados) nao desabilitam botoes durante o processamento, permitindo cliques duplos.
- **Acao**: Revisar `ProfessionalApprovals.tsx`, `Sidebar.tsx` (publicar), e `Settings.tsx` (resetar) para garantir que todos os botoes de acao exibam spinner e fiquem `disabled` enquanto a operacao esta em andamento.

---

## Resumo Tecnico

| # | Melhoria | Arquivos afetados |
|---|----------|-------------------|
| 1 | Leaked Password Protection | Dashboard Supabase |
| 2 | Validacao de inputs | `Login.tsx`, `Portal.tsx` |
| 3 | Reset de senha | `Login.tsx`, novo `ResetPassword.tsx`, `App.tsx` |
| 4 | Refatorar Portal.tsx | `Portal.tsx`, novos componentes em `src/components/portal/` |
| 5 | Remover `as any` | `types.ts`, contextos, hooks |
| 6 | Guard de team_id no Portal | `Portal.tsx` |
| 7 | Debounce no sync | `AppDataContext.tsx`, `ServiceStateContext.tsx` |
| 8 | Loading states consistentes | `ProfessionalApprovals.tsx`, `Sidebar.tsx`, `Settings.tsx` |

Cada melhoria sera implementada e testada individualmente antes de prosseguir para a proxima, garantindo que o sistema permaneca funcional em cada etapa.

