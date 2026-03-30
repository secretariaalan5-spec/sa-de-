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
import { Plus, CalendarDays, Trash2 } from 'lucide-react';

interface Schedule {
  id: string;
  employee_id: string;
  date: string;
  type: string;
  unit_id: string | null;
  created_at: string;
}

interface Employee { id: string; name: string; category_id: string | null; }

export default function Schedules() {
  const { roleInfo, isAdmin, isChief, isRH } = useAuthContext();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [open, setOpen] = useState(false);
  const [empId, setEmpId] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState('normal');

  const canCreate = isAdmin || isChief;

  const load = async () => {
    const [s, e] = await Promise.all([
      supabase.from('schedules').select('*').order('date', { ascending: false }).limit(100),
      supabase.from('employees').select('id, name, category_id').eq('active', true).order('name'),
    ]);
    setSchedules(s.data ?? []);
    setEmployees(e.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!empId || !date) return;

    const { error } = await supabase.from('schedules').insert({
      employee_id: empId,
      date,
      type,
      team_id: roleInfo?.team_id,
      created_by: roleInfo ? undefined : undefined,
    });

    if (error) {
      toast.error('Erro: ' + error.message);
      return;
    }

    toast.success(type === 'extra' ? 'Escala extra criada! +2 créditos gerados.' : 'Escala criada!');
    setOpen(false);
    setEmpId('');
    setDate('');
    setType('normal');
    load();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('schedules').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Escala removida');
    load();
  };

  const getEmpName = (id: string) => employees.find(e => e.id === id)?.name ?? '—';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Escalas</h1>
          <p className="text-muted-foreground text-sm">
            {isRH ? 'Visualização' : 'Gerencie escalas normais e extras'}
          </p>
        </div>
        {canCreate && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus size={16} /> Nova Escala</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Escala</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
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
                  <Label>Data</Label>
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="extra">Extra (+2 créditos)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">Criar Escala</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {schedules.length === 0 ? (
        <div className="empty-state">
          <CalendarDays className="mx-auto mb-3 text-muted-foreground" size={40} />
          <p className="text-muted-foreground">Nenhuma escala cadastrada</p>
        </div>
      ) : (
        <div className="page-card overflow-x-auto">
          <table className="schedule-table">
            <thead>
              <tr>
                <th className="text-left">Funcionário</th>
                <th className="text-left">Data</th>
                <th className="text-left">Tipo</th>
                {canCreate && <th className="text-right">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {schedules.map(s => (
                <tr key={s.id}>
                  <td className="font-medium">{getEmpName(s.employee_id)}</td>
                  <td>{new Date(s.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                  <td>
                    <Badge variant={s.type === 'extra' ? 'default' : 'secondary'}>
                      {s.type === 'extra' ? 'Extra' : 'Normal'}
                    </Badge>
                  </td>
                  {canCreate && (
                    <td className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                        <Trash2 size={16} className="text-destructive" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
