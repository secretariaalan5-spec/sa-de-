---
name: premium-ui
description: O padrão ouro de Design e Interfaces Premium (UX/UI de Alta Retenção).
---

# Skill: Premium UI (Shadcn + TailwindCSS)

Sua missão na interface é gerar a sensação de "Uau, esse sistema é de altíssimo nível".

## 1. Visual Limpo, Sólido e Moderno
- Esqueça bordas escuras ou chapadas. Use `ring-1 ring-black/5` ou sombras sutis `shadow-sm` para cards.
- Crie profundidade usando Glassmorphism sutil (`backdrop-blur-md bg-white/60`) quando apropriado para modals e asides.

## 2. Micro-Interações
- Todo elemento clicável DEVE ter um feedback visual claro (`hover:bg-slate-50 transition-colors`).
- Não aplique transições lentas. Padrão ouro é `duration-200 ease-in-out`.

## 3. Tipografia Premium
- Use hierarquia de fontes clara. Títulos grandes e limpos (`tracking-tight text-slate-900`), legendas amenas (`text-sm text-slate-500`).
- Sem blocos massivos de texto em bold. Bold é só para chamar a atenção ao dado vital.

## 4. Ícones Delicados
- Ao incluir botões com ícones, use a biblioteca `lucide-react`. O tamanho padrão é `w-4 h-4 mr-2`.
- Ícones que denotam categorias de funcionários devem respeitar cores semânticas estabelecidas no projeto.

## 5. Mobile-First Elegante
- No mobile, margins viram `m-2` ou `m-4`. Pads viram `p-4`. Evite tabelas no mobile, converta para "Card-Lists".
