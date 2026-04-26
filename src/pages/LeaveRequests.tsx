import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useDataSubscription } from '@/hooks/useDataSubscription';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, CalendarOff, Check, Clock, CheckCircle2, XCircle, AlertTriangle, Tag, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import LeaveRequestForm from '@/components/leave/LeaveRequestForm';

interface LeaveReq {
  id: string;
  employee_id: string;
  status: string;
  days_requested: number;
  leave_dates: string[];
  observations: string | null;
  created_at: string;
  requested_by: string | null;
  decided_by: string | null;
  decided_at: string | null;
  is_short_notice?: boolean;
}

interface Employee { id: string; name: string; category_id: string | null; unit_id: string | null; }
interface Schedule { employee_id: string; date: string; }
interface Credit { employee_id: string; amount: number; }
interface Profile { user_id: string; display_name: string; }
interface Category { id: string; name: string; color: string; }
interface Unit { id: string; name: string; }

// ─── Color theme by category (same logic as Schedules.tsx) ───────────────────
const getCategoryColor = (categories: Category[], catName: string) => {
  return catName ? (categories.find(c => c.name === catName)?.color ?? '#6366f1') : '#6366f1';
};

export default function LeaveRequests() {
  const { roleInfo, isAdmin, isChief, isManager, isRH } = useAuthContext();
  const [requests, setRequests] = useState<LeaveReq[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const canRequest = isAdmin || isManager;
  const canApprove = isAdmin || isChief;

  const getBalance = (employeeId: string) =>
    credits.filter(c => c.employee_id === employeeId).reduce((s, c) => s + c.amount, 0);

  const load = async () => {
    const teamId = roleInfo?.team_id;
    if (!teamId) return;

    let employeesQuery = supabase
      .from('employees')
      .select('id, name, category_id, unit_id')
      .eq('active', true)
      .eq('team_id', teamId)
      .order('name');

    if (isChief && !isAdmin && !isRH && roleInfo?.category_ids?.length) {
      employeesQuery = employeesQuery.in('category_id', roleInfo.category_ids);
    }
    if (isManager && !isAdmin && !isRH && roleInfo?.unit_id) {
      employeesQuery = employeesQuery.eq('unit_id', roleInfo.unit_id);
    }

    const [r, e, s, c, p, cats, us] = await Promise.all([
      supabase.from('leave_requests').select('*').eq('team_id', teamId).order('created_at', { ascending: false }).limit(300),
      employeesQuery,
      supabase.from('schedules').select('employee_id, date').eq('team_id', teamId).limit(500),
      supabase.from('leave_credits').select('employee_id, amount').eq('team_id', teamId),
      supabase.from('profiles').select('user_id, display_name'),
      supabase.from('categories').select('id, name, color').eq('team_id', teamId),
      supabase.from('units').select('id, name').eq('team_id', teamId),
    ]);

    setRequests(r.data ?? []);
    setEmployees(e.data ?? []);
    setSchedules(s.data ?? []);
    setCredits(c.data ?? []);
    setProfiles(p.data ?? []);
    setCategories(cats.data ?? []);
    setUnits(us.data ?? []);
  };

  useEffect(() => { load(); }, [roleInfo?.team_id]);
  useDataSubscription(['leave_requests', 'employees', 'schedules', 'leave_credits'], load);

  const handleRequest = async (empId: string, leaveDates: string[], obs: string, isShortNotice: boolean) => {
    const conflictDates = leaveDates.filter(d => schedules.some(s => s.employee_id === empId && s.date === d));
    if (conflictDates.length > 0) {
      const formatted = conflictDates.map(d => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')).join(', ');
      toast.error(`Conflito: o profissional tem escala em ${formatted}. Remova a escala antes.`);
      return;
    }

    const existingLeaves = requests.filter(r => r.employee_id === empId && (r.status === 'pending' || r.status === 'approved'));
    const allExistingDates = existingLeaves.flatMap(r => r.leave_dates ?? []);
    const duplicateDates = leaveDates.filter(d => allExistingDates.includes(d));
    if (duplicateDates.length > 0) {
      const formatted = duplicateDates.map(d => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')).join(', ');
      toast.error(`Já existe folga (pendente ou aprovada) em ${formatted}.`);
      return;
    }

    const balance = getBalance(empId);
    if (balance < leaveDates.length) {
      toast.error(`Saldo insuficiente. Saldo atual: ${balance} crédito(s), solicitado: ${leaveDates.length} dia(s).`);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('leave_requests').insert({
      employee_id: empId,
      leave_dates: leaveDates,
      days_requested: leaveDates.length,
      observations: obs || null,
      team_id: roleInfo?.team_id,
      requested_by: user?.id ?? null,
      status: 'pending',
      is_short_notice: isShortNotice,
    });

    if (error) { toast.error(error.message || 'Erro ao solicitar folga.'); return; }
    toast.success(isShortNotice
      ? 'Pedido enviado! ⚠️ Sujeito à análise (antecedência < 7 dias).'
      : 'Pedido de folga enviado!');
    setOpen(false);
    load();
  };

  const handleDecision = async (id: string, status: 'approved' | 'rejected') => {
    if (decidingId) return;
    if (status === 'approved') {
      const req = requests.find(r => r.id === id);
      if (req) {
        const balance = getBalance(req.employee_id);
        if (balance < req.days_requested) {
          toast.error(`Não é possível aprovar: saldo insuficiente (${balance} crédito(s), necessário: ${req.days_requested}).`);
          return;
        }
      }
    }

    setDecidingId(id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('leave_requests')
        .update({ status, decided_by: user?.id ?? null, decided_at: new Date().toISOString() } as any)
        .eq('id', id);

      if (error) { toast.error(error.message || 'Erro ao processar decisão.'); return; }
      toast.success(status === 'approved' ? 'Folga aprovada! Créditos deduzidos.' : 'Folga negada.');
      load();
    } finally {
      setDecidingId(null);
    }
  };

  const getEmployee = (id: string) => employees.find(e => e.id === id) ?? null;
  const getCategoryName = (catId: string | null) => catId ? (categories.find(c => c.id === catId)?.name ?? '') : '';
  const getUnitName = (unitId: string | null) => unitId ? (units.find(u => u.id === unitId)?.name ?? '') : '';
  const getUserName = (id: string | null) => id ? (profiles.find(p => p.user_id === id)?.display_name ?? null) : null;

  // Filter out leave requests from deleted (inactive) employees
  const activeRequests = requests.filter(r => getEmployee(r.employee_id) !== null);

  const filtered = activeRequests.filter(r => activeTab === 'all' ? true : r.status === activeTab);

  const counts = {
    pending: activeRequests.filter(r => r.status === 'pending').length,
    approved: activeRequests.filter(r => r.status === 'approved').length,
    rejected: activeRequests.filter(r => r.status === 'rejected').length,
  };

  const roleDescription = isRH
    ? 'Visualização de todos os pedidos'
    : isManager ? 'Solicite folgas para profissionais da sua unidade'
    : isChief ? 'Aprove ou recuse pedidos da sua categoria'
    : 'Todos os pedidos de folga';

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pedidos de Folga</h1>
          <p className="text-muted-foreground text-sm">{roleDescription}</p>
        </div>
        {canRequest && (
          <Button className="gap-2" onClick={() => setOpen(true)}>
            <Plus size={16} /> Solicitar Folga
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { key: 'pending',  count: counts.pending,  label: 'Pendentes', color: 'text-amber-600',    bg: 'bg-amber-500/10',      border: 'border-amber-500/30' },
          { key: 'approved', count: counts.approved, label: 'Aprovados', color: 'text-emerald-600',  bg: 'bg-emerald-500/10',    border: 'border-emerald-500/20' },
          { key: 'rejected', count: counts.rejected, label: 'Negados',   color: 'text-destructive',  bg: 'bg-destructive/10',    border: 'border-destructive/20' },
        ].map(({ key, count, label, color, bg, border }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'rounded-xl border p-4 text-center transition-all hover:shadow-sm active:scale-[0.98]',
              activeTab === key ? `${bg} ${border}` : 'bg-card border-border hover:border-primary/30'
            )}
          >
            <p className={cn('text-2xl font-bold', color)}>{count}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="pending">Pendentes ({counts.pending})</TabsTrigger>
          <TabsTrigger value="approved">Aprovados</TabsTrigger>
          <TabsTrigger value="rejected">Negados</TabsTrigger>
          <TabsTrigger value="all">Todos</TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab} className="mt-4">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <CalendarOff className="mx-auto mb-3 text-muted-foreground" size={40} />
              <p className="text-muted-foreground">Nenhum pedido nesta categoria</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(req => {
                const emp = getEmployee(req.employee_id);
                const empName = emp?.name ?? '—';
                const cat = getCategoryName(emp?.category_id ?? null);
                const unit = getUnitName(emp?.unit_id ?? null);
                const catColor = getCategoryColor(categories, cat);
                const initials = empName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
                const empBalance = getBalance(req.employee_id);

                const statusStyle = req.status === 'approved'
                  ? { label: 'Aprovado', bg: 'bg-white/90 text-emerald-700' }
                  : req.status === 'rejected'
                  ? { label: 'Negado', bg: 'bg-white/90 text-destructive' }
                  : { label: 'Pendente', bg: 'bg-white/90 text-amber-700' };

                return (
                  <div 
                    key={req.id} 
                    className="rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow p-4 flex flex-col gap-3"
                    style={{ backgroundColor: `${catColor}15` }}
                  >
                    {/* ── Top Row ─────────────────────────── */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 font-bold text-sm border"
                          style={{ borderColor: catColor, color: catColor }}
                        >
                          {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-[15px] leading-tight truncate text-foreground">{empName}</p>
                          <div className="flex gap-x-3 gap-y-1 mt-1 flex-wrap text-foreground/80">
                            {cat && (
                              <span className="flex items-center gap-1.5 text-[12px] font-medium whitespace-nowrap">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: catColor }} />
                                <span style={{ color: catColor }}>{cat}</span>
                              </span>
                            )}
                            {unit && (
                              <span className="flex items-center gap-1 text-[12px] text-muted-foreground whitespace-nowrap">
                                <MapPin size={12} /> {unit}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className={cn('text-[10px] uppercase font-bold px-2.5 py-1 rounded-full shrink-0 shadow-sm', statusStyle.bg)}>
                        {statusStyle.label}
                      </span>
                    </div>

                    {/* ── Days + date chips ────────────────────────────────────── */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-x-3 gap-y-1.5 mt-1 text-foreground/80">
                      <span className="text-[13px] font-medium whitespace-nowrap">
                        {req.days_requested} {req.days_requested > 1 ? 'dias solicitados' : 'dia solicitado'}:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {req.leave_dates?.map(d => (
                          <span key={d} className="px-2 py-0.5 rounded text-[11px] font-medium bg-black/5 dark:bg-white/10 text-foreground">
                            {new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* ── Short-notice / observations ────────────────────────────────────── */}
                    {(req.is_short_notice || req.observations) && (
                      <div className="p-2.5 rounded-md bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-foreground/90">
                        {req.is_short_notice && (
                          <div className="flex items-center gap-1.5 font-bold mb-1">
                            <AlertTriangle size={13} className="shrink-0 text-amber-500" />
                            <span className="uppercase tracking-tight text-[10px]">EXCEÇÃO: ANTECEDÊNCIA &lt; 7 DIAS</span>
                          </div>
                        )}
                        {req.observations && (
                          <p className="italic text-xs font-medium">
                            "{req.observations}"
                          </p>
                        )}
                      </div>
                    )}

                    {/* ── Footer: audit + balance + actions ────────────────────────────────────── */}
                    <div className="flex items-center justify-between mt-1 pt-3 border-t border-black/5 dark:border-white/10 gap-2 flex-wrap">
                      <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground font-medium">
                        <span>
                          Solicitado por <b>{getUserName(req.requested_by) ?? 'Desconhecido'}</b>{' '}
                          em {new Date(req.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </span>
                        {req.decided_by && (
                          <span>
                            {req.status === 'approved' ? 'Aprovado' : 'Negado'} por{' '}
                            <b>{getUserName(req.decided_by) ?? 'Desconhecido'}</b>{' '}
                            em {req.decided_at && new Date(req.decided_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </span>
                        )}
                      </div>

                      {/* Balance + decision buttons */}
                      {canApprove && req.status === 'pending' && (
                        <div className="flex items-center gap-2 shrink-0">
                          <div className={cn(
                            'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border',
                            empBalance >= req.days_requested
                              ? 'bg-black/5 dark:bg-white/10 border-transparent text-foreground'
                              : 'bg-red-500/20 border-red-500/30 text-destructive'
                          )}>
                            <span className="opacity-70">Saldo:</span> {empBalance}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-3 text-xs font-bold border border-black/10 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-foreground"
                            disabled={!!decidingId}
                            onClick={() => handleDecision(req.id, 'rejected')}
                          >
                            {decidingId === req.id ? '...' : 'Negar'}
                          </Button>
                          <Button
                            size="sm"
                            className="h-8 px-4 text-xs font-bold bg-black text-white hover:bg-black/80 shadow-sm transition-colors"
                            disabled={!!decidingId || empBalance < req.days_requested}
                            onClick={() => handleDecision(req.id, 'approved')}
                          >
                            {decidingId === req.id ? '...' : 'Aprovar'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Leave Request Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Solicitar Folga</DialogTitle>
            <DialogDescription>Selecione o período clicando na data de início e fim.</DialogDescription>
          </DialogHeader>
          <LeaveRequestForm
            employees={employees}
            getBalance={getBalance}
            onSubmit={handleRequest}
            onCancel={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
