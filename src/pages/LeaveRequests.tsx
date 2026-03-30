import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, CalendarOff, Check, X } from 'lucide-react';

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

export default function LeaveRequests() {
  const { roleInfo, isAdmin, isChief, isManager, isRH } = useAuthContext();
  const [requests, setRequests] = useState<LeaveReq[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);
  const [empId, setEmpId] = useState('');
  const [dates, setDates] = useState('');
  const [obs, setObs] = useState('');

  const canRequest = isAdmin || isManager;
  const canApprove = isAdmin || isChief;

  const load = async () => {
    const [r, e] = await Promise.all([
      supabase.from('leave_requests').select('*').order('created_at', { ascending: false }),
      supabase.from('employees').select('id, name').eq('active', true).order('name'),
    ]);
    setRequests(r.data ?? []);
    setEmployees(e.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const handleRequest = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!empId || !dates) return;

    const leaveDates = dates.split(',').map(d => d.trim()).filter(Boolean);

    const { error } = await supabase.from('leave_requests').insert({
      employee_id: empId,
      leave_dates: leaveDates,
      days_requested: leaveDates.length,
      observations: obs || null,
      team_id: roleInfo?.team_id,
      requested_by: null, // will be set by auth context
      status: 'pending',
    });

    if (error) { toast.error(error.message); return; }
    toast.success('Pedido de folga enviado!');
    setOpen(false);
    setEmpId('');
    setDates('');
    setObs('');
    load();
  };

  const handleDecision = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase
      .from('leave_requests')
      .update({
        status,
        decided_by: null, // RLS ensures only chiefs/admins
        decided_at: new Date().toISOString(),
      } as any)
      .eq('id', id);

    if (error) { toast.error(error.message); return; }
    toast.success(status === 'approved' ? 'Folga aprovada! -1 crédito deduzido.' : 'Folga negada.');
    load();
  };

  const getEmpName = (id: string) => employees.find(e => e.id === id)?.name ?? '—';

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
    pending: { label: 'Pendente', variant: 'secondary' },
    approved: { label: 'Aprovado', variant: 'default' },
    rejected: { label: 'Negado', variant: 'destructive' },
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pedidos de Folga</h1>
          <p className="text-muted-foreground text-sm">
            {isRH ? 'Visualização' : isManager ? 'Solicite folgas' : isChief ? 'Aprove ou recuse pedidos' : 'Gerencie pedidos'}
          </p>
        </div>
        {canRequest && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus size={16} /> Solicitar Folga</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Solicitar Folga</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleRequest} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Funcionário</Label>
                  <Select value={empId} onValueChange={setEmpId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {employees.map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Datas (separadas por vírgula, ex: 2026-04-01, 2026-04-02)</Label>
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

      {requests.length === 0 ? (
        <div className="empty-state">
          <CalendarOff className="mx-auto mb-3 text-muted-foreground" size={40} />
          <p className="text-muted-foreground">Nenhum pedido de folga</p>
        </div>
      ) : (
        <div className="page-card overflow-x-auto">
          <table className="schedule-table">
            <thead>
              <tr>
                <th className="text-left">Funcionário</th>
                <th className="text-left">Datas</th>
                <th className="text-left">Dias</th>
                <th className="text-left">Status</th>
                {canApprove && <th className="text-right">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {requests.map(r => {
                const cfg = statusConfig[r.status] ?? statusConfig.pending;
                return (
                  <tr key={r.id}>
                    <td className="font-medium">{getEmpName(r.employee_id)}</td>
                    <td className="text-xs">
                      {r.leave_dates?.map(d => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR')).join(', ')}
                    </td>
                    <td>{r.days_requested}</td>
                    <td><Badge variant={cfg.variant}>{cfg.label}</Badge></td>
                    {canApprove && (
                      <td className="text-right space-x-1">
                        {r.status === 'pending' && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => handleDecision(r.id, 'approved')}>
                              <Check size={16} className="text-accent" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDecision(r.id, 'rejected')}>
                              <X size={16} className="text-destructive" />
                            </Button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
