---
description: Como implementar novas funcionalidades com design Premium (Poder de Fogo)
---
Este workflow define os passos para garantir que qualquer nova funcionalidade siga os padrões estéticos de alto nível estabelecidos no projeto.

1. **Análise de Requisitos e Design**:
   - Entender o objetivo da funcionalidade.
   - Definir os ícones (Lucide) e cores semânticas (cat-nurse, cat-tech, etc) que serão usados.
2. **Atualização da Fundação (Tokens)**:
   - Se necessário, adicionar novos tokens de cor ou utilitários em `src/index.css`.
3. **Criação de Componentes UI**:
   - Usar Shadcn/UI como base.
   - Aplicar classes de design premium: `.page-card`, `.form-section`, ou efeitos de glassmorphism `.portal-glass`.
4. **Implementação da Lógica**:
   - Criar ou atualizar Hooks em `src/hooks` para persistência de dados.
   - Garantir que a tipagem TypeScript esteja 100% correta em `src/types`.
5. **Polimento Visual (Micro-animações)**:
   - Aplicar classes de animação do Tailwind (ex: `animate-fade-in`).
   - Adicionar estados de hover e transições suaves (`transition-all`).
6. **Verificação e GitHub**:
   - Testar a responsividade.
   - Realizar o commit com mensagem semântica e fazer o push.
