import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useDataSubscription } from '@/hooks/useDataSubscription';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowRightLeft, Plus, AlertTriangle } from 'lucide-react';

interface Transfer {
  id: string;
  employee_id: string;
  from_unit_id: string | null;
  to_unit_id: string | null;
  transferred_at: string;
  transferred_by: string | null;
}

interface Employee { id: string; name: string; unit_id: string | null; }
interface Unit { id: string; name: string; }
interface Schedule { employee_id: string; date: string; }
interface LeaveReq { employee_id: string; status: string; }

export default function Transfers() {
  const { roleInfo, isAdmin, isChief, isManager, isRH } = useAuthContext();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveReq[]>([]);
  const [open, setOpen] = useState(false);
  const [empId, setEmpId] = useState('');
  const [toUnitId, setToUnitId] = useState('');
  const [blockReason, setBlockReason] = useState('');

  const canTransfer = isAdmin || isChief;
  const today = new Date().toISOString().split('T')[0];

  const load = async () => {
    const teamId = roleInfo?.team_id;
    if (!teamId) return;

    let employeesQuery = supabase.from('employees').select('id, name, unit_id').eq('active', true).eq('team_id', teamId).order('name');
    if (isChief && !isAdmin && !isRH && roleInfo?.category_ids?.length) {
      employeesQuery = employeesQuery.in('category_id', roleInfo.category_ids);
    }
    if (isManager && !isAdmin && !isRH && roleInfo?.unit_id) {
      employeesQuery = employeesQuery.eq('unit_id', roleInfo.unit_id);
    }

    const [t, e, u, s, lr] = await Promise.all([
      supabase.from('transfer_history').select('*').eq('team_id', teamId).order('transferred_at', { ascending: false }).limit(200),
      employeesQuery,
      supabase.from('units').select('id, name').eq('active', true),
      supabase.from('schedules').select('employee_id, date').eq('team_id', teamId).gte('date', today).limit(200),
      supabase.from('leave_requests').select('employee_id, status').eq('team_id', teamId).eq('status', 'pending').limit(100),
    ]);
    setTransfers(t.data ?? []);
    setEmployees(e.data ?? []);
    setUnits(u.data ?? []);
    setSchedules(s.data ?? []);
    setLeaveRequests(lr.data ?? []);
  };

  useEffect(() => { load(); }, [roleInfo?.team_id]);
  useDataSubscription(['transfer_history', 'employees', 'units', 'leave_requests'], load);

  // Check transfer blocking when employee changes
  useEffect(() => {
    if (!empId) { setBlockReason(''); return; }

    const futureSchedules = schedules.filter(s => s.employee_id === empId && s.date >= today);
    if (futureSchedules.length > 0) {
      const formatted = futureSchedules.slice(0, 3).map(s => new Date(s.date + 'T12:00:00').toLocaleDateString('pt-BR')).join(', ');
      setBlockReason(`Profissional tem ${futureSchedules.length} escala(s) futura(s) (${formatted}${futureSchedules.length > 3 ? '...' : ''}). Remova antes de transferir.`);
      return;
    }

    const pendingLeaves = leaveRequests.filter(lr => lr.employee_id === empId);
    if (pendingLeaves.length > 0) {
      setBlockReason(`Profissional tem ${pendingLeaves.length} pedido(s) de folga pendente(s). Resolva antes de transferir.`);
      return;
    }

    setBlockReason('');
  }, [empId, schedules, leaveRequests, today]);

  const handleTransfer = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!empId || !toUnitId) return;
    if (blockReason) {
      toast.error(blockReason);
      return;
    }

    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    if (emp.unit_id === toUnitId) {
      toast.error('O profissional já está nessa unidade.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { error: thErr } = await supabase.from('transfer_history').insert({
      employee_id: empId,
      from_unit_id: emp.unit_id,
      to_unit_id: toUnitId,
      team_id: roleInfo?.team_id,
      transferred_by: user?.id ?? null,
    });
    if (thErr) {
      toast.error('Erro ao registrar transferência.');
      return;
    }

    await supabase.from('employees').update({ unit_id: toUnitId } as any).eq('id', empId);

    toast.success('Transferência realizada!');
    setOpen(false);
    setEmpId('');
    setToUnitId('');
    load();
  };

  const getEmpName = (id: string) => employees.find(e => e.id === id)?.name ?? null;
  const getUnitName = (id: string | null) => units.find(u => u.id === id)?.name ?? '—';

  // Filter out transfers from deleted (inactive) employees
  const activeTransfers = transfers.filter(t => getEmpName(t.employee_id) !== null);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transferências</h1>
          <p className="text-muted-foreground text-sm">Histórico de transferências entre unidades</p>
        </div>
        {canTransfer && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus size={16} /> Transferir</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Transferir Funcionário</DialogTitle>
                <DialogDescription>Mova um funcionário para outra unidade.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleTransfer} className="space-y-4">
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

                {blockReason && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <AlertTriangle size={16} className="text-destructive mt-0.5 shrink-0" />
                    <p className="text-xs text-destructive">{blockReason}</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Unidade de destino</Label>
                  <Select value={toUnitId} onValueChange={setToUnitId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {units.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={!!blockReason}>Confirmar Transferência</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {activeTransfers.length === 0 ? (
        <div className="empty-state">
          <ArrowRightLeft className="mx-auto mb-3 text-muted-foreground" size={40} />
          <p className="text-muted-foreground">Nenhuma transferência registrada</p>
        </div>
      ) : (
        <>
          {/* Mobile View: Cards */}
          <div className="space-y-3 sm:hidden mt-2">
            {activeTransfers.map(t => (
              <div key={t.id} className="page-card p-3 space-y-2">
                <div className="flex justify-between items-start">
                  <p className="font-semibold text-sm">{getEmpName(t.employee_id) ?? '—'}</p>
                  <span className="text-[10px] text-muted-foreground">{new Date(t.transferred_at).toLocaleDateString('pt-BR')}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{getUnitName(t.from_unit_id)}</span>
                  <span className="text-primary font-bold">→</span>
                  <span className="text-primary font-bold">{getUnitName(t.to_unit_id)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden sm:block bg-card rounded-xl border border-border shadow-sm overflow-hidden mt-2">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Funcionário</th>
                    <th className="px-5 py-4 font-semibold">De</th>
                    <th className="px-5 py-4 font-semibold">Para</th>
                    <th className="px-5 py-4 font-semibold">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activeTransfers.map(t => (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-foreground">{getEmpName(t.employee_id) ?? '—'}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{getUnitName(t.from_unit_id)}</td>
                      <td className="px-5 py-3.5 text-muted-foreground font-medium text-primary">{getUnitName(t.to_unit_id)}</td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs">{new Date(t.transferred_at).toLocaleDateString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
