---
name: business-logic
description: Estruturação avançada de Lógica de Negócios e Transações Escaláveis.
---

# Skill: Lógica de Negócios Escalável (Business Logic Pro)

Quando estiver escrevendo lógicas complexas, aja sob a ótica de um Tech Lead de SaaS.

## 1. Lidando com Estados (React State)
- Prefira derivar variáveis locais a criar dependências desnecessárias de múltiplos `useState`. Exemplo: calcular `canEdit` no próprio escopo de renderização baseando-se no contexto atual.
- Evite aninhamentos complexos em Hooks de Efeitos (`useEffect`). Mantenha os efeitos limpos e previsíveis.

## 2. Tratamento de Conflitos
- Sempre que criar agendamentos, escalas ou inserção de blocos, escreva código robusto (Guard Clauses) para verificar colisões de datas (`isAlreadyFiltered`).
- Bloqueie no lado do cliente (rápido) E tampe na Procedure ou Trigger do banco de dados (seguro e definitivo).

## 3. Gestão de Logs & Auditoria Silenciosa
- A plataforma não é apenas visual. Como engenheiro de negócios, lembre-se que ações críticas (ex: mudanças de status e deleções) devem obrigatoriamente ser engatilhadas por RLS ou Hooks e logadas.
- Mensagens de erro para o usuário (via `toast.error`) devem ser sempre explicativas (ex: "Não foi possível escalar João pois ele já possui folga neste dia."), em vez de erros rudimentares HTTP.

## 4. Abstração Desacoplada
- Evite colocar 1.000 linhas no mesmo arquivo. Componentize modais de edição ou lógicas de listagem.
