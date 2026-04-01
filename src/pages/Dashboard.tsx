import { useAuthContext } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useNavigate } from 'react-router-dom';
import { Users, CalendarDays, CalendarOff, Building2, Tag, Clock, TrendingUp, ArrowRight, Megaphone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useRoleDetails } from '@/hooks/useRoleDetails';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface RecentLeave {
  id: string;
  employee_id: string;
  status: string;
  days_requested: number;
  created_at: string;
}

interface ScheduleStat {
  total: number;
  extras: number;
}

export default function Dashboard() {
  const { roleInfo, isAdmin, isRH, isChief, isManager, user } = useAuthContext();
  const navigate = useNavigate();
  const { roleDescription, categoryNames, unitName } = useRoleDetails(roleInfo);
  const [stats, setStats] = useState({ employees: 0, schedules: 0, pendingLeaves: 0, units: 0, categories: 0, approvedLeaves: 0 });
  const [recentLeaves, setRecentLeaves] = useState<RecentLeave[]>([]);
  const [scheduleStat, setScheduleStat] = useState<ScheduleStat>({ total: 0, extras: 0 });
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!roleInfo?.team_id) return;
    const teamId = roleInfo.team_id;

    const load = async () => {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const monthEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

      // First get active employee IDs to filter all queries
      const { data: activeEmps } = await supabase.from('employees').select('id, name').eq('team_id', teamId).eq('active', true);
      const activeIds = (activeEmps ?? []).map(e => e.id);
      setEmployees(activeEmps ?? []);

      if (activeIds.length === 0) {
        setStats({ employees: 0, schedules: 0, pendingLeaves: 0, units: 0, categories: 0, approvedLeaves: 0 });
        setRecentLeaves([]);
        setScheduleStat({ total: 0, extras: 0 });
        return;
      }

      const [sch, leaves, units, cats, approved, recent, extras] = await Promise.all([
        supabase.from('schedules').select('id', { count: 'exact', head: true }).eq('team_id', teamId).in('employee_id', activeIds).gte('date', monthStart).lt('date', monthEnd),
        supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('team_id', teamId).in('employee_id', activeIds).eq('status', 'pending'),
        supabase.from('units').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
        supabase.from('categories').select('id', { count: 'exact', head: true }).eq('team_id', teamId),
        supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('team_id', teamId).in('employee_id', activeIds).eq('status', 'approved'),
        supabase.from('leave_requests').select('id, employee_id, status, days_requested, created_at').eq('team_id', teamId).in('employee_id', activeIds).order('created_at', { ascending: false }).limit(5),
        supabase.from('schedules').select('id', { count: 'exact', head: true }).eq('team_id', teamId).in('employee_id', activeIds).eq('type', 'extra').gte('date', monthStart).lt('date', monthEnd),
      ]);
      setStats({
        employees: activeIds.length,
        schedules: sch.count ?? 0,
        pendingLeaves: leaves.count ?? 0,
        units: units.count ?? 0,
        categories: cats.count ?? 0,
        approvedLeaves: approved.count ?? 0,
      });
      setRecentLeaves(recent.data ?? []);
      setScheduleStat({ total: sch.count ?? 0, extras: extras.count ?? 0 });
    };
    load();
  }, [roleInfo?.team_id]);

  const getEmpName = (id: string) => employees.find(e => e.id === id)?.name ?? '—';

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    rh: 'RH',
    category_chief: 'Chefe de Categoria',
    unit_manager: 'Gerente de Unidade',
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
    pending: { label: 'Pendente', variant: 'secondary' },
    approved: { label: 'Aprovado', variant: 'default' },
    rejected: { label: 'Negado', variant: 'destructive' },
  };

  const mainCards = [
    { label: 'Profissionais', value: stats.employees, icon: Users, color: 'bg-primary/10 text-primary', link: '/funcionarios' },
    { label: 'Escalas do Mês', value: stats.schedules, icon: CalendarDays, color: 'bg-accent/10 text-accent', link: '/escalas' },
    { label: 'Folgas Pendentes', value: stats.pendingLeaves, icon: CalendarOff, color: 'bg-warning/20 text-warning-foreground', link: '/folgas' },
    ...(isAdmin || isRH ? [
      { label: 'Unidades', value: stats.units, icon: Building2, color: 'bg-secondary text-secondary-foreground', link: '/unidades' },
    ] : []),
    ...(isAdmin ? [
      { label: 'Categorias', value: stats.categories, icon: Tag, color: 'bg-muted text-muted-foreground', link: '/categorias' },
    ] : []),
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{greeting()}</h1>
          <p className="text-muted-foreground text-sm">
            {roleDescription || roleLabels[roleInfo?.role ?? 'admin']}
            {isRH && ' — somente visualização'}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground bg-card px-3 py-2 rounded-lg border border-border">
          <Clock size={14} />
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {mainCards.map(card => (
          <button
            key={card.label}
            onClick={() => navigate(card.link)}
            className="stat-card flex items-center gap-3 text-left hover:shadow-md transition-shadow cursor-pointer group"
          >
            <div className={`p-2.5 rounded-xl ${card.color}`}>
              <card.icon size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground truncate">{card.label}</p>
            </div>
            <ArrowRight size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Schedule Summary */}
        <div className="page-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <TrendingUp size={18} className="text-primary" />
              Resumo do Mês
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/escalas')} className="text-xs gap-1">
              Ver escalas <ArrowRight size={12} />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-primary">{scheduleStat.total}</p>
              <p className="text-xs text-muted-foreground mt-1">Escalas Totais</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-3xl font-bold text-accent">{scheduleStat.extras}</p>
              <p className="text-xs text-muted-foreground mt-1">Extras (+2 créditos)</p>
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Folgas Aprovadas</p>
              <p className="text-xs text-muted-foreground">Total acumulado</p>
            </div>
            <p className="text-2xl font-bold text-accent">{stats.approvedLeaves}</p>
          </div>
        </div>

        {/* Recent Leave Requests */}
        <div className="page-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <CalendarOff size={18} className="text-warning-foreground" />
              Últimos Pedidos de Folga
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/folgas')} className="text-xs gap-1">
              Ver todos <ArrowRight size={12} />
            </Button>
          </div>
          {recentLeaves.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum pedido recente</p>
          ) : (
            <div className="space-y-2">
              {recentLeaves.map(r => {
                const cfg = statusConfig[r.status] ?? statusConfig.pending;
                return (
                  <div key={r.id} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{getEmpName(r.employee_id)}</p>
                      <p className="text-xs text-muted-foreground">{r.days_requested} dia(s) • {new Date(r.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      {(isAdmin || isChief || isManager) && (
        <div className="page-card">
          <h2 className="font-semibold mb-3">Ações Rápidas</h2>
          <div className="flex flex-wrap gap-2">
            {(isAdmin || isChief) && (
              <Button variant="outline" size="sm" onClick={() => navigate('/escalas')} className="gap-2">
                <CalendarDays size={14} /> Nova Escala
              </Button>
            )}
            {(isAdmin || isManager) && (
              <>
                <Button variant="outline" size="sm" onClick={() => navigate('/funcionarios')} className="gap-2">
                  <Users size={14} /> Novo Funcionário
                </Button>
                <Button variant="outline" size="sm" onClick={() => navigate('/folgas')} className="gap-2">
                  <CalendarOff size={14} /> Solicitar Folga
                </Button>
              </>
            )}
            {isAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate('/convites')} className="gap-2">
                <Tag size={14} /> Gerar Convite
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
