/**
 * EmptyState — Estado vazio reutilizável.
 *
 * Exibido quando não há dados para mostrar em uma lista ou tabela.
 * Usa a classe utilitária .empty-state do design system.
 */

import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  /** Ícone ilustrativo */
  icon: LucideIcon;
  /** Título curto descrevendo o estado */
  title: string;
  /** Texto auxiliar com orientação ao usuário */
  description: string;
  /** Label do botão de ação (opcional) */
  actionLabel?: string;
  /** Callback do botão de ação */
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="empty-state px-4">
      {/* Ícone centralizado com fundo muted */}
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
        <Icon className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction}>{actionLabel}</Button>
      )}
    </div>
  );
}
