import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, CalendarOff, Check, X, Clock, CheckCircle2, XCircle } from 'lucide-react';
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
    const [r, e, s, c] = await Promise.all([
      supabase.from('leave_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('employees').select('id, name').eq('active', true).order('name'),
      supabase.from('schedules').select('employee_id, date'),
      supabase.from('leave_credits').select('employee_id, amount'),
    ]);
    setRequests(r.data ?? []);
    setEmployees(e.data ?? []);
    setSchedules(s.data ?? []);
    setCredits(c.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const handleRequest = async (empId: string, leaveDates: string[], obs: string) => {
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
    });

    if (error) { toast.error('Erro ao solicitar folga.'); return; }
    toast.success('Pedido de folga enviado!');
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

    if (error) { toast.error('Erro ao processar decisão.'); return; }
    toast.success(status === 'approved' ? 'Folga aprovada! Créditos deduzidos.' : 'Folga negada.');
    load();
  };

  const getEmpName = (id: string) => employees.find(e => e.id === id)?.name ?? '—';

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive'; icon: React.ElementType }> = {
    pending: { label: 'Pendente', variant: 'secondary', icon: Clock },
    approved: { label: 'Aprovado', variant: 'default', icon: CheckCircle2 },
    rejected: { label: 'Negado', variant: 'destructive', icon: XCircle },
  };

  const filtered = requests.filter(r => activeTab === 'all' ? true : r.status === activeTab);

  const counts = {
    pending: requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
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
                      <p className="font-medium text-sm">{getEmpName(r.employee_id)}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.days_requested} dia(s) • {r.leave_dates?.map(d => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })).join(', ')}
                      </p>
                      {r.observations && <p className="text-xs text-muted-foreground mt-0.5 italic">"{r.observations}"</p>}
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
        <DialogContent className="max-w-md">
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
