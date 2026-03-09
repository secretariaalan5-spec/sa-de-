/**
 * PageHeader — Cabeçalho padronizado de página.
 *
 * Garante hierarquia tipográfica consistente em todas as telas:
 * - H1 para o título (text-2xl font-bold tracking-tight)
 * - Texto muted para a descrição
 * - Slot de ação alinhado à direita (botões, filtros, etc.)
 */

import { ReactNode } from 'react';

interface PageHeaderProps {
  /** Título principal (renderizado como H1) */
  title: string;
  /** Texto descritivo abaixo do título */
  description?: string;
  /** Elemento de ação (botão, filtro) alinhado à direita */
  action?: ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div>
        {/* H1 usa estilos base definidos no index.css */}
        <h1>{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
