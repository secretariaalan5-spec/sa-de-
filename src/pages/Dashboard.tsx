import { useAuthContext } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { Users, CalendarDays, CalendarOff, Building2 } from 'lucide-react';

export default function Dashboard() {
  const { roleInfo, isAdmin, isRH } = useAuthContext();
  const [stats, setStats] = useState({ employees: 0, schedules: 0, pendingLeaves: 0, units: 0 });

  useEffect(() => {
    const load = async () => {
      const [emp, sch, leaves, units] = await Promise.all([
        supabase.from('employees').select('id', { count: 'exact', head: true }),
        supabase.from('schedules').select('id', { count: 'exact', head: true }),
        supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('units').select('id', { count: 'exact', head: true }),
      ]);
      setStats({
        employees: emp.count ?? 0,
        schedules: sch.count ?? 0,
        pendingLeaves: leaves.count ?? 0,
        units: units.count ?? 0,
      });
    };
    load();
  }, []);

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    rh: 'RH (Leitura)',
    category_chief: 'Chefe de Categoria',
    unit_manager: 'Gerente de Unidade',
  };

  const cards = [
    { label: 'Funcionários', value: stats.employees, icon: Users, color: 'text-primary' },
    { label: 'Escalas (mês)', value: stats.schedules, icon: CalendarDays, color: 'text-accent' },
    { label: 'Folgas Pendentes', value: stats.pendingLeaves, icon: CalendarOff, color: 'text-warning' },
    ...(isAdmin || isRH ? [{ label: 'Unidades', value: stats.units, icon: Building2, color: 'text-muted-foreground' }] : []),
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">
          {roleLabels[roleInfo?.role ?? 'admin']}
          {isRH && ' — somente visualização'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(card => (
          <div key={card.label} className="stat-card flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-muted ${card.color}`}>
              <card.icon size={24} />
            </div>
            <div>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
