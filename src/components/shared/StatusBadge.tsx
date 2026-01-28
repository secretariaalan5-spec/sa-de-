interface StatusBadgeProps {
  active: boolean;
}

export function StatusBadge({ active }: StatusBadgeProps) {
  return (
    <span className={active ? 'badge-active' : 'badge-inactive'}>
      {active ? 'Ativo' : 'Inativo'}
    </span>
  );
}
