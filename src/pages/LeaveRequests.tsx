import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useDataSubscription } from '@/hooks/useDataSubscription';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, CalendarOff, Check, X, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
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

interface Employee { id: string; name: string; }
interface Schedule { employee_id: string; date: string; }
interface Credit { employee_id: string; amount: number; }
interface Profile { user_id: string; display_name: string; }

export default function LeaveRequests() {
  const { roleInfo, isAdmin, isChief, isManager, isRH } = useAuthContext();
  const [requests, setRequests] = useState<LeaveReq[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');

  const canRequest = isAdmin || isManager;
  const canApprove = isAdmin || isChief;

  const getBalance = (employeeId: string) => {
    return credits.filter(c => c.employee_id === employeeId).reduce((s, c) => s + c.amount, 0);
  };

  const load = async () => {
    const teamId = roleInfo?.team_id;
    if (!teamId) return;

    let employeesQuery = supabase.from('employees').select('id, name').eq('active', true).eq('team_id', teamId).order('name');
    
    if (isChief && !isAdmin && !isRH && roleInfo?.category_ids?.length) {
      employeesQuery = employeesQuery.in('category_id', roleInfo.category_ids);
    }
    if (isManager && !isAdmin && !isRH && roleInfo?.unit_id) {
      employeesQuery = employeesQuery.eq('unit_id', roleInfo.unit_id);
    }

    const [r, e, s, c, p] = await Promise.all([
      supabase.from('leave_requests').select('*').eq('team_id', teamId).order('created_at', { ascending: false }).limit(300),
      employeesQuery,
      supabase.from('schedules').select('employee_id, date').eq('team_id', teamId).limit(500),
      supabase.from('leave_credits').select('employee_id, amount').eq('team_id', teamId),
      supabase.from('profiles').select('user_id, display_name'),
    ]);
    setRequests(r.data ?? []);
    setEmployees(e.data ?? []);
    setSchedules(s.data ?? []);
    setCredits(c.data ?? []);
    setProfiles(p.data ?? []);
  };

  useEffect(() => { load(); }, [roleInfo?.team_id]);
  useDataSubscription(['leave_requests', 'employees', 'schedules', 'leave_credits'], load);

  const handleRequest = async (empId: string, leaveDates: string[], obs: string, isShortNotice: boolean) => {

    // 1. Check schedule conflicts
    const conflictDates = leaveDates.filter(d => schedules.some(s => s.employee_id === empId && s.date === d));
    if (conflictDates.length > 0) {
      const formatted = conflictDates.map(d => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')).join(', ');
      toast.error(`Conflito: o profissional tem escala em ${formatted}. Remova a escala antes.`);
      return;
    }

    // 2. Check duplicate leave dates
    const existingLeaves = requests.filter(r => r.employee_id === empId && (r.status === 'pending' || r.status === 'approved'));
    const allExistingDates = existingLeaves.flatMap(r => r.leave_dates ?? []);
    const duplicateDates = leaveDates.filter(d => allExistingDates.includes(d));
    if (duplicateDates.length > 0) {
      const formatted = duplicateDates.map(d => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')).join(', ');
      toast.error(`Já existe folga (pendente ou aprovada) em ${formatted}.`);
      return;
    }

    // 3. Check balance
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
      ? 'Pedido enviado! ⚠️ Sujeito à análise (antecedência < 10 dias).'
      : 'Pedido de folga enviado!');
    setOpen(false);
    load();
  };

  const handleDecision = async (id: string, status: 'approved' | 'rejected') => {
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

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('leave_requests')
      .update({ status, decided_by: user?.id ?? null, decided_at: new Date().toISOString() } as any)
      .eq('id', id);

    if (error) { toast.error(error.message || 'Erro ao processar decisão.'); return; }
    toast.success(status === 'approved' ? 'Folga aprovada! Créditos deduzidos.' : 'Folga negada.');
    load();
  };

  const getEmpName = (id: string) => employees.find(e => e.id === id)?.name ?? null;
  const getUserName = (id: string | null) => {
    if (!id) return null;
    return profiles.find(p => p.user_id === id)?.display_name || null;
  };

  // Filter out leave requests from deleted (inactive) employees
  const activeRequests = requests.filter(r => getEmpName(r.employee_id) !== null);

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive'; icon: React.ElementType }> = {
    pending: { label: 'Pendente', variant: 'secondary', icon: Clock },
    approved: { label: 'Aprovado', variant: 'default', icon: CheckCircle2 },
    rejected: { label: 'Negado', variant: 'destructive', icon: XCircle },
  };

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
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-warning-foreground">{counts.pending}</p>
          <p className="text-xs text-muted-foreground">Pendentes</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-accent">{counts.approved}</p>
          <p className="text-xs text-muted-foreground">Aprovados</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-destructive">{counts.rejected}</p>
          <p className="text-xs text-muted-foreground">Negados</p>
        </div>
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
            <div className="space-y-2">
              {filtered.map(r => {
                const cfg = statusConfig[r.status] ?? statusConfig.pending;
                const StatusIcon = cfg.icon;
                const empBalance = getBalance(r.employee_id);
                return (
                  <div key={r.id} className="page-card p-3 sm:p-4 hover:border-primary/30 transition-colors flex flex-col">
                    {/* Top Row: Title & Status Badge */}
                    <div className="flex items-start justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', 
                          r.status === 'pending' ? 'bg-warning' : 
                          r.status === 'approved' ? 'bg-accent' : 'bg-destructive'
                        )} />
                        <h4 className="font-semibold text-foreground text-sm leading-none">{getEmpName(r.employee_id) ?? '—'}</h4>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn("text-[10px] uppercase font-bold px-2 py-0.5 rounded-sm tracking-wider",
                          r.status === 'pending' ? 'bg-warning/15 text-warning-foreground' : 
                          r.status === 'approved' ? 'bg-accent/15 text-accent' : 'bg-destructive/15 text-destructive'
                        )}>
                          {cfg.label}
                        </span>
                      </div>
                    </div>

                    {/* DATES ROW: Clearly shows how many days and exact dates */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-x-3 gap-y-1.5 mb-3">
                      <div className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                        {r.days_requested} {r.days_requested > 1 ? 'dias' : 'dia'}:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {r.leave_dates?.map(d => (
                          <span key={d} className="px-2 py-0.5 rounded-[4px] text-[11px] font-semibold bg-secondary/60 text-secondary-foreground border border-border shadow-sm">
                            {new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Exceção e Observação (Only if exists) */}
                    {(r.is_short_notice || r.observations) && (
                      <div className={cn("mb-3 p-2.5 rounded-md text-xs", 
                        r.is_short_notice ? "bg-amber-50 border border-amber-200" : "bg-muted/40 border border-border/50"
                      )}>
                        {r.is_short_notice && (
                          <div className="flex items-center gap-1.5 text-amber-700 font-bold mb-1">
                            <AlertTriangle size={13} className="shrink-0" />
                            <span className="uppercase tracking-tight text-[10px]">EXCEÇÃO: ANTECEDÊNCIA &lt; 10 DIAS</span>
                          </div>
                        )}
                        {r.observations && (
                          <p className={cn("italic", r.is_short_notice ? "text-amber-900" : "text-muted-foreground")}>
                            "{r.observations}"
                          </p>
                        )}
                      </div>
                    )}

                    {/* Footer: Balance, Audit, Actions */}
                    <div className="flex items-center justify-between mt-auto pt-2.5 border-t border-border text-[9px] sm:text-[10px] text-muted-foreground">
                      <div className="flex flex-col gap-0.5">
                        <span>
                          Solicitado por {getUserName(r.requested_by) ?? 'Desconhecido'} em {new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                        </span>
                        {r.decided_by && (
                          <span>
                            {r.status === 'approved' ? 'Aprovado' : 'Negado'} por {getUserName(r.decided_by) ?? 'Desconhecido'} em {r.decided_at && new Date(r.decided_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                          </span>
                        )}
                        {r.status === 'pending' && (
                          <span className="text-foreground/70">
                            Saldo atual do profissional: <b className={cn("text-[11px]", empBalance >= r.days_requested ? 'text-primary' : 'text-destructive')}>{empBalance}</b>
                          </span>
                        )}
                      </div>

                      {/* Actions for Pending */}
                      {canApprove && r.status === 'pending' && (
                        <div className="flex gap-2 shrink-0 ml-2">
                          <Button
                            size="sm" 
                            variant="outline"
                            className="h-7 px-3 text-[11px] font-bold border-destructive/40 text-destructive hover:bg-destructive hover:text-white transition-colors"
                            onClick={() => handleDecision(r.id, 'rejected')}
                          >
                            Negar
                          </Button>
                          <Button
                            size="sm" 
                            className="h-7 px-3 text-[11px] font-bold bg-accent hover:bg-accent/90 text-white shadow-sm transition-colors"
                            onClick={() => handleDecision(r.id, 'approved')}
                          >
                            Aprovar
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

      {/* Leave Request Dialog with Calendar */}
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
