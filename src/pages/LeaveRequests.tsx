import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, CalendarOff, Check, X, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeaveReq {
  id: string;
  employee_id: string;
  status: string;
  days_requested: number;
  leave_dates: string[];
  observations: string | null;
  created_at: string;
}

interface Employee { id: string; name: string; }
interface Schedule { employee_id: string; date: string; }

export default function LeaveRequests() {
  const { roleInfo, isAdmin, isChief, isManager, isRH } = useAuthContext();
  const [requests, setRequests] = useState<LeaveReq[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [open, setOpen] = useState(false);
  const [empId, setEmpId] = useState('');
  const [dates, setDates] = useState('');
  const [obs, setObs] = useState('');
  const [activeTab, setActiveTab] = useState('pending');

  const canRequest = isAdmin || isManager;
  const canApprove = isAdmin || isChief;

  const load = async () => {
    const [r, e, s] = await Promise.all([
      supabase.from('leave_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('employees').select('id, name').eq('active', true).order('name'),
      supabase.from('schedules').select('employee_id, date'),
    ]);
    setRequests(r.data ?? []);
    setEmployees(e.data ?? []);
    setSchedules(s.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const handleRequest = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!empId || !dates) return;

    const leaveDates = dates.split(',').map(d => d.trim()).filter(Boolean);

    // Check for schedule conflicts
    const conflictDates = leaveDates.filter(d => schedules.some(s => s.employee_id === empId && s.date === d));
    if (conflictDates.length > 0) {
      const formatted = conflictDates.map(d => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')).join(', ');
      toast.error(`Conflito: o profissional tem escala em ${formatted}. Remova a escala antes de solicitar folga.`);
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
    setOpen(false); setEmpId(''); setDates(''); setObs('');
    load();
  };

  const handleDecision = async (id: string, status: 'approved' | 'rejected') => {
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
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus size={16} /> Solicitar Folga</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Solicitar Folga</DialogTitle>
                <DialogDescription>Envie um pedido para aprovação do chefe de categoria.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleRequest} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Funcionário</Label>
                  <Select value={empId} onValueChange={setEmpId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {employees.map(e => (<SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Datas (separadas por vírgula, formato AAAA-MM-DD)</Label>
                  <Input value={dates} onChange={e => setDates(e.target.value)} placeholder="2026-04-01, 2026-04-02" required />
                </div>
                <div className="space-y-1.5">
                  <Label>Observações</Label>
                  <Input value={obs} onChange={e => setObs(e.target.value)} />
                </div>
                <Button type="submit" className="w-full">Enviar Pedido</Button>
              </form>
            </DialogContent>
          </Dialog>
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
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      {canApprove && r.status === 'pending' && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDecision(r.id, 'approved')}>
                            <Check size={16} className="text-accent" />
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
    </div>
  );
}
