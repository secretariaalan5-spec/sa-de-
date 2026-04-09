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

    const [r, e, s, c, p] = await Promise.all([
      supabase.from('leave_requests').select('*').eq('team_id', teamId).order('created_at', { ascending: false }).limit(300),
      supabase.from('employees').select('id, name').eq('active', true).eq('team_id', teamId).order('name'),
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
                  <div key={r.id} className="page-card flex items-center gap-4 p-4">
                    <div className={cn('p-2 rounded-lg',
                      r.status === 'pending' && 'bg-warning/15',
                      r.status === 'approved' && 'bg-accent/15',
                      r.status === 'rejected' && 'bg-destructive/15',
                    )}>
                      <StatusIcon size={18} className={cn(
                        r.status === 'pending' && 'text-warning-foreground',
                        r.status === 'approved' && 'text-accent',
                        r.status === 'rejected' && 'text-destructive',
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{getEmpName(r.employee_id) ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.days_requested} dia(s) • {r.leave_dates?.map(d => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })).join(', ')}
                      </p>
                      {r.is_short_notice && (
                        <div className="flex flex-col gap-1.5 mt-2">
                          <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-amber-50 border border-amber-200 w-fit">
                            <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                            <span className="text-xs font-bold text-amber-700">EXCEÇÃO — ANTECEDÊNCIA &lt; 10 DIAS</span>
                          </div>
                          {r.observations && (
                            <div className="pl-1 border-l-2 border-amber-300 ml-1">
                              <p className="text-xs font-medium text-amber-900">Justificativa:</p>
                              <p className="text-xs text-amber-800 italic mt-0.5">{r.observations}</p>
                            </div>
                          )}
                        </div>
                      )}
                      {!r.is_short_notice && r.observations && (
                        <p className="text-xs text-muted-foreground mt-0.5 italic">"{r.observations}"</p>
                      )}
                      {r.requested_by && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Solicitado por: <span className="font-medium">{getUserName(r.requested_by) ?? 'Desconhecido'}</span>
                          {' • '}{new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      {(r.status === 'approved' || r.status === 'rejected') && r.decided_by && (
                        <p className="text-[10px] mt-0.5">
                          <span className={cn(r.status === 'approved' ? 'text-accent' : 'text-destructive')}>
                            {r.status === 'approved' ? 'Aprovado' : 'Negado'} por: {getUserName(r.decided_by) ?? 'Desconhecido'}
                          </span>
                          {r.decided_at && (
                            <span className="text-muted-foreground">
                              {' • '}{new Date(r.decided_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </p>
                      )}
                      {r.status === 'pending' && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Saldo: <span className={cn('font-semibold', empBalance >= r.days_requested ? 'text-primary' : 'text-destructive')}>{empBalance}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      {canApprove && r.status === 'pending' && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            onClick={() => handleDecision(r.id, 'approved')}
                            title={empBalance < r.days_requested ? 'Saldo insuficiente para aprovar' : 'Aprovar'}
                          >
                            <Check size={16} className={cn(empBalance < r.days_requested ? 'text-muted-foreground' : 'text-accent')} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDecision(r.id, 'rejected')}>
                            <X size={16} className="text-destructive" />
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
