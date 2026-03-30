import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowRightLeft, Plus } from 'lucide-react';

interface Transfer {
  id: string;
  employee_id: string;
  from_unit_id: string | null;
  to_unit_id: string | null;
  transferred_at: string;
}

interface Employee { id: string; name: string; unit_id: string | null; }
interface Unit { id: string; name: string; }

export default function Transfers() {
  const { roleInfo, isAdmin, isChief, isRH } = useAuthContext();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [open, setOpen] = useState(false);
  const [empId, setEmpId] = useState('');
  const [toUnitId, setToUnitId] = useState('');

  const canTransfer = isAdmin || isChief;

  const load = async () => {
    const [t, e, u] = await Promise.all([
      supabase.from('transfer_history').select('*').order('transferred_at', { ascending: false }),
      supabase.from('employees').select('id, name, unit_id').eq('active', true).order('name'),
      supabase.from('units').select('id, name').eq('active', true),
    ]);
    setTransfers(t.data ?? []);
    setEmployees(e.data ?? []);
    setUnits(u.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const handleTransfer = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!empId || !toUnitId) return;

    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    // Insert transfer history
    const { error: thErr } = await supabase.from('transfer_history').insert({
      employee_id: empId,
      from_unit_id: emp.unit_id,
      to_unit_id: toUnitId,
      team_id: roleInfo?.team_id,
      transferred_by: null,
    });
    if (thErr) { toast.error(thErr.message); return; }

    // Update employee unit
    await supabase.from('employees').update({ unit_id: toUnitId } as any).eq('id', empId);

    toast.success('Transferência realizada!');
    setOpen(false);
    setEmpId('');
    setToUnitId('');
    load();
  };

  const getEmpName = (id: string) => employees.find(e => e.id === id)?.name ?? '—';
  const getUnitName = (id: string | null) => units.find(u => u.id === id)?.name ?? '—';

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
                <Button type="submit" className="w-full">Confirmar Transferência</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {transfers.length === 0 ? (
        <div className="empty-state">
          <ArrowRightLeft className="mx-auto mb-3 text-muted-foreground" size={40} />
          <p className="text-muted-foreground">Nenhuma transferência registrada</p>
        </div>
      ) : (
        <div className="page-card overflow-x-auto">
          <table className="schedule-table">
            <thead>
              <tr>
                <th className="text-left">Funcionário</th>
                <th className="text-left">De</th>
                <th className="text-left">Para</th>
                <th className="text-left">Data</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map(t => (
                <tr key={t.id}>
                  <td className="font-medium">{getEmpName(t.employee_id)}</td>
                  <td>{getUnitName(t.from_unit_id)}</td>
                  <td>{getUnitName(t.to_unit_id)}</td>
                  <td>{new Date(t.transferred_at).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
