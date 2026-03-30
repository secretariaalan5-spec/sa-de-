/**
 * RH Dashboard — Painel de leitura com todas as folgas de todos os profissionais.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarOff, Search, Filter, Users, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useProfile } from '@/hooks/useProfile';
import { LEAVE_TYPE_LABELS, LeaveType } from '@/types/serviceSchedule';
import { cn } from '@/lib/utils';

interface LeaveRow {
  id: string;
  professional_id: string;
  category: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  observations: string | null;
  status: string;
  created_at: string;
  admin_notes: string | null;
}

interface ProfInfo {
  id: string;
  full_name: string;
  avatar_url: string | null;
  category: string;
  unit_id: string | null;
}

export default function RHDashboard() {
  const { profile } = useProfile();
  const [leaves, setLeaves] = useState<LeaveRow[]>([]);
  const [professionals, setProfessionals] = useState<ProfInfo[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    if (!profile?.team_id) return;
    setLoading(true);

    const [leavesRes, profsRes, unitsRes] = await Promise.all([
      supabase
        .from('professional_leave_requests' as any)
        .select('*')
        .eq('team_id', profile.team_id)
        .order('created_at', { ascending: false }) as any,
      supabase
        .from('professional_users')
        .select('id, full_name, avatar_url, category, unit_id')
        .eq('team_id', profile.team_id) as any,
      supabase
        .from('units')
        .select('id, name')
        .eq('team_id', profile.team_id) as any,
    ]);

    setLeaves((leavesRes.data || []) as LeaveRow[]);
    setProfessionals((profsRes.data || []) as ProfInfo[]);
    setUnits((unitsRes.data || []) as { id: string; name: string }[]);
    setLoading(false);
  }, [profile?.team_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const profMap = useMemo(() => {
    const m: Record<string, ProfInfo> = {};
    professionals.forEach(p => { m[p.id] = p; });
    return m;
  }, [professionals]);

  const unitMap = useMemo(() => {
    const m: Record<string, string> = {};
    units.forEach(u => { m[u.id] = u.name; });
    return m;
  }, [units]);

  const filtered = useMemo(() => {
    return leaves.filter(l => {
      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && l.category !== categoryFilter) return false;
      if (search) {
        const prof = profMap[l.professional_id];
        const name = prof?.full_name?.toLowerCase() || '';
        if (!name.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [leaves, statusFilter, categoryFilter, search, profMap]);

  const stats = useMemo(() => ({
    total: leaves.length,
    pending: leaves.filter(l => l.status === 'pending').length,
    approved: leaves.filter(l => l.status === 'approved').length,
    rejected: leaves.filter(l => l.status === 'rejected').length,
  }), [leaves]);

  const statusIcon = (s: string) => {
    if (s === 'approved') return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
    if (s === 'rejected') return <XCircle className="w-3.5 h-3.5 text-destructive" />;
    return <Clock className="w-3.5 h-3.5 text-warning" />;
  };

  const statusLabel = (s: string) => {
    if (s === 'approved') return 'Aprovado';
    if (s === 'rejected') return 'Rejeitado';
    return 'Pendente';
  };

  if (loading) return <div className="p-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Painel RH — Folgas"
        description="Visão completa de todos os afastamentos dos profissionais (somente leitura)"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary"><CalendarOff className="w-4 h-4" /></div>
            <div>
              <p className="text-lg font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-warning/10 text-warning"><Clock className="w-4 h-4" /></div>
            <div>
              <p className="text-lg font-bold">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-green-500/10 text-green-500"><CheckCircle2 className="w-4 h-4" /></div>
            <div>
              <p className="text-lg font-bold">{stats.approved}</p>
              <p className="text-xs text-muted-foreground">Aprovados</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-destructive/10 text-destructive"><XCircle className="w-4 h-4" /></div>
            <div>
              <p className="text-lg font-bold">{stats.rejected}</p>
              <p className="text-xs text-muted-foreground">Rejeitados</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar profissional..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] bg-background">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="approved">Aprovados</SelectItem>
            <SelectItem value="rejected">Rejeitados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[150px] bg-background">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent className="bg-popover">
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="nurse">Enfermeiros</SelectItem>
            <SelectItem value="tech">Técnicos</SelectItem>
            <SelectItem value="acs">ACS</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Leave list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={CalendarOff}
          title="Nenhum afastamento encontrado"
          description="Ajuste os filtros ou aguarde novos registros."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(leave => {
            const prof = profMap[leave.professional_id];
            const unitName = prof?.unit_id ? unitMap[prof.unit_id] : null;
            const catLabel = leave.category === 'nurse' ? 'Enfermeiro(a)' : leave.category === 'acs' ? 'ACS' : 'Técnico(a)';

            return (
              <div key={leave.id} className="bg-card rounded-2xl border border-border p-4 shadow-sm">
                <div className="flex items-center gap-4">
                  <Avatar className="h-10 w-10 shrink-0 ring-2 ring-muted overflow-hidden">
                    {prof?.avatar_url && <AvatarImage src={prof.avatar_url} alt={prof?.full_name} />}
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs font-bold">
                      {(prof?.full_name || 'P').slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">{prof?.full_name || 'Profissional'}</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">{catLabel}</Badge>
                      {unitName && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">{unitName}</Badge>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="secondary" className="text-[11px] font-medium">
                        {LEAVE_TYPE_LABELS[leave.leave_type as LeaveType] || leave.leave_type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(leave.start_date + 'T00:00:00'), 'dd/MM/yyyy')}
                        {leave.end_date !== leave.start_date && (
                          <> a {format(new Date(leave.end_date + 'T00:00:00'), 'dd/MM/yyyy')}</>
                        )}
                      </span>
                      <span className="text-xs font-bold text-primary">
                        {leave.days_requested} {leave.days_requested === 1 ? 'dia' : 'dias'}
                      </span>
                      <div className="flex items-center gap-1">
                        {statusIcon(leave.status)}
                        <span className="text-xs font-medium">{statusLabel(leave.status)}</span>
                      </div>
                    </div>
                    {leave.observations && (
                      <p className="text-[11px] text-muted-foreground italic mt-1 truncate">"{leave.observations}"</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
