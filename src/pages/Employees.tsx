import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Users } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  category_id: string | null;
  unit_id: string | null;
  active: boolean;
  team_id: string;
}

interface Category { id: string; name: string; }
interface Unit { id: string; name: string; }

export default function Employees() {
  const { roleInfo, isAdmin, isManager, isRH } = useAuthContext();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unitId, setUnitId] = useState('');

  const canAdd = isAdmin || isManager;

  const load = async () => {
    const [e, c, u] = await Promise.all([
      supabase.from('employees').select('*').eq('active', true).order('name'),
      supabase.from('categories').select('id, name').eq('active', true),
      supabase.from('units').select('id, name').eq('active', true),
    ]);
    setEmployees(e.data ?? []);
    setCategories(c.data ?? []);
    setUnits(u.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!name.trim()) return;

    const { error } = await supabase.from('employees').insert({
      name: name.trim(),
      category_id: categoryId || null,
      unit_id: unitId || (roleInfo?.unit_id ?? null),
      team_id: roleInfo?.team_id,
    });

    if (error) {
      console.error('Employee insert error');
      toast.error('Erro ao cadastrar funcionário. Verifique os dados.');
      return;
    }

    toast.success('Funcionário cadastrado!');
    setName('');
    setCategoryId('');
    setUnitId('');
    setOpen(false);
    load();
  };

  const getCategoryName = (id: string | null) => categories.find(c => c.id === id)?.name ?? '—';
  const getUnitName = (id: string | null) => units.find(u => u.id === id)?.name ?? '—';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Funcionários</h1>
          <p className="text-muted-foreground text-sm">
            {isRH ? 'Visualização' : 'Gerencie os funcionários'}
          </p>
        </div>
        {canAdd && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus size={16} /> Novo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar Funcionário</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Unidade</Label>
                  <Select value={unitId} onValueChange={setUnitId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {units.map(u => (
                        <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">Cadastrar</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {employees.length === 0 ? (
        <div className="empty-state">
          <Users className="mx-auto mb-3 text-muted-foreground" size={40} />
          <p className="text-muted-foreground">Nenhum funcionário cadastrado</p>
        </div>
      ) : (
        <div className="page-card overflow-x-auto">
          <table className="schedule-table">
            <thead>
              <tr>
                <th className="text-left">Nome</th>
                <th className="text-left">Categoria</th>
                <th className="text-left">Unidade</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id}>
                  <td className="font-medium">{emp.name}</td>
                  <td>{getCategoryName(emp.category_id)}</td>
                  <td>{getUnitName(emp.unit_id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
