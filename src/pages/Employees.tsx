import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useDataSubscription } from '@/hooks/useDataSubscription';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Users, Pencil, Search, LayoutGrid, List, Trash2, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import EmployeeDetailDialog from '@/components/EmployeeDetailDialog';

interface Employee {
  id: string; name: string; category_id: string | null;
  unit_id: string | null; active: boolean; team_id: string;
  phone?: string | null;
}
interface Category { id: string; name: string; color: string; }
interface Unit { id: string; name: string; }

export default function Employees() {
  const { roleInfo, isAdmin, isManager, isChief, isRH } = useAuthContext();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('all');
  const [filterUnit, setFilterUnit] = useState('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [detailEmp, setDetailEmp] = useState<Employee | null>(null);

  const canAdd = isAdmin || isManager;
  const canEdit = isAdmin || isChief || isManager;
  const canDelete = isAdmin || isManager;

  const load = async () => {
    if (!roleInfo?.team_id) return;
    const teamId = roleInfo.team_id;
    const [e, c, u] = await Promise.all([
      supabase.from('employees').select('*').eq('active', true).eq('team_id', teamId).order('name'),
      supabase.from('categories').select('id, name, color').eq('active', true).eq('team_id', teamId),
      supabase.from('units').select('id, name').eq('active', true).eq('team_id', teamId),
    ]);
    setEmployees(e.data ?? []);
    setCategories(c.data ?? []);
    setUnits(u.data ?? []);
  };

  useEffect(() => { load(); }, []);
  useDataSubscription(['employees', 'categories', 'units'], load);

  const handleAdd = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!name.trim()) return;
    if (!roleInfo?.team_id) {
      toast.error('Permissões ainda não carregadas. Recarregue a página e tente novamente.');
      return;
    }
    const { error } = await supabase.from('employees').insert({
      name: name.trim(),
      phone: phone.trim() || null,
      category_id: categoryId || null,
      unit_id: isManager ? (roleInfo.unit_id ?? null) : (unitId || null),
      team_id: roleInfo.team_id,
    });
    if (error) { toast.error(error.message || 'Erro ao cadastrar funcionário.'); return; }
    toast.success('Funcionário cadastrado!');
    setName(''); setPhone(''); setCategoryId(''); setUnitId(''); setOpen(false); load();
  };

  const openEdit = (emp: Employee) => {
    setEditEmp(emp); setName(emp.name); setPhone(emp.phone ?? ''); setCategoryId(emp.category_id ?? ''); setUnitId(emp.unit_id ?? ''); setEditOpen(true);
  };

  const handleEdit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!editEmp || !name.trim()) return;
    const updateData: any = { name: name.trim(), phone: phone.trim() || null };
    if (isAdmin || isChief) { updateData.category_id = categoryId || null; updateData.unit_id = unitId || null; }
    const { error } = await supabase.from('employees').update(updateData).eq('id', editEmp.id);
    if (error) { toast.error('Erro ao atualizar funcionário.'); return; }

    // Se a unidade mudou, registrar em transfer_history
    const newUnitId = unitId || null;
    const oldUnitId = editEmp.unit_id || null;
    if (newUnitId !== oldUnitId && (isAdmin || isChief)) {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      await supabase.from('transfer_history').insert({
        employee_id: editEmp.id,
        from_unit_id: oldUnitId,
        to_unit_id: newUnitId,
        team_id: roleInfo?.team_id,
        transferred_by: currentUser?.id ?? null,
      });
      toast.success('Funcionário atualizado e transferência registrada!');
    } else {
      toast.success('Funcionário atualizado!');
    }
    setEditOpen(false); setEditEmp(null); setName(''); setPhone(''); setCategoryId(''); setUnitId(''); load();
  };

  const handleDelete = async (id: string, empName: string) => {
    if (!confirm(`Tem certeza que deseja remover o profissional "${empName}"?\n\nIsso também apagará todas as folgas, escalas, transferências e créditos associados.`)) return;

    // Cascade delete all related records
    await Promise.all([
      supabase.from('leave_requests').delete().eq('employee_id', id),
      supabase.from('transfer_history').delete().eq('employee_id', id),
      supabase.from('leave_credits').delete().eq('employee_id', id),
      supabase.from('schedules').delete().eq('employee_id', id),
    ]);

    const { error } = await supabase.from('employees').update({ active: false }).eq('id', id);
    if (error) { toast.error('Erro ao remover profissional.'); return; }
    toast.success('Profissional removido e dados relacionados apagados!'); load();
  };

  const getCat = (id: string | null) => categories.find(c => c.id === id);
  const getUnitName = (id: string | null) => units.find(u => u.id === id)?.name ?? '—';

  const filtered = employees.filter(e => {
    if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCat !== 'all' && e.category_id !== filterCat) return false;
    if (filterUnit !== 'all' && e.unit_id !== filterUnit) return false;
    return true;
  });

  const roleDescription = isRH ? 'Visualização de todos os profissionais'
    : isChief ? 'Profissionais da sua categoria'
    : isManager ? 'Profissionais da sua unidade'
    : 'Todos os profissionais';

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Profissionais</h1>
          <p className="text-muted-foreground text-sm">{roleDescription}</p>
        </div>
        {canAdd && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus size={16} /> Novo Profissional</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Cadastrar Profissional</DialogTitle><DialogDescription>Adicione um novo profissional ao sistema.</DialogDescription></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-1.5"><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
                <div className="space-y-1.5"><Label>WhatsApp (Opcional)</Label><Input type="tel" placeholder="(00) 90000-0000" value={phone} onChange={e => setPhone(e.target.value)} /></div>
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {!isManager && (
                  <div className="space-y-1.5">
                    <Label>Unidade</Label>
                    <Select value={unitId} onValueChange={setUnitId}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <Button type="submit" className="w-full">Cadastrar</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-card rounded-xl border border-border p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-2.5 text-muted-foreground" />
          <Input placeholder="Buscar profissional..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        {(isAdmin || isRH) && (
          <>
            <Select value={filterCat} onValueChange={setFilterCat}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Categorias</SelectItem>
                {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterUnit} onValueChange={setFilterUnit}>
              <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Unidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Unidades</SelectItem>
                {units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </>
        )}
        <div className="flex bg-muted rounded-lg p-0.5">
          <button onClick={() => setViewMode('cards')} className={cn('view-toggle-btn px-3 py-1.5', viewMode === 'cards' && 'active')}><LayoutGrid size={14} /></button>
          <button onClick={() => setViewMode('table')} className={cn('view-toggle-btn px-3 py-1.5', viewMode === 'table' && 'active')}><List size={14} /></button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">{filtered.length} profissional(is) encontrado(s)</p>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Profissional</DialogTitle><DialogDescription>Atualize os dados do profissional.</DialogDescription></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>WhatsApp (Opcional)</Label><Input type="tel" placeholder="(00) 90000-0000" value={phone} onChange={e => setPhone(e.target.value)} /></div>
            {(isAdmin || isRH) && (
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {(isAdmin || isChief) && (
              <div className="space-y-1.5">
                <Label>Unidade</Label>
                <Select value={unitId} onValueChange={setUnitId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <Button type="submit" className="w-full">Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Employee Detail Dialog */}
      <EmployeeDetailDialog
        employeeId={detailEmp?.id ?? null}
        employeeName={detailEmp?.name ?? ''}
        open={!!detailEmp}
        onOpenChange={(o) => { if (!o) setDetailEmp(null); }}
      />

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Users className="mx-auto mb-3 text-muted-foreground" size={40} />
          <p className="text-muted-foreground">Nenhum profissional encontrado</p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.map(emp => {
            const cat = getCat(emp.category_id);
            return (
              <div key={emp.id} className="prof-card group cursor-pointer" onClick={() => setDetailEmp(emp)}>
                <div className="h-1 rounded-full mb-3" style={{ backgroundColor: cat?.color ?? 'hsl(var(--muted))' }} />
                <p className="font-semibold text-sm">{emp.name}</p>
                <div className="flex items-center gap-2 mt-2">
                  {cat && <Badge variant="secondary" className="text-[10px]" style={{ borderColor: cat.color, color: cat.color }}>{cat.name}</Badge>}
                  <span className="text-[10px] text-muted-foreground">{getUnitName(emp.unit_id)}</span>
                </div>
                {(isAdmin || isRH || isChief || isManager) && emp.phone && (
                  <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_4px_#22c55e]" /> {emp.phone}
                  </p>
                )}
                <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDetailEmp(emp); }} className="h-7 text-xs gap-1">
                    <Eye size={12} /> Ver Histórico
                  </Button>
                  {canEdit && (
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(emp); }} className="h-7 text-xs gap-1">
                      <Pencil size={12} /> Editar
                    </Button>
                  )}
                  {canDelete && (
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(emp.id, emp.name); }} className="h-7 text-xs gap-1 text-destructive hover:text-destructive">
                      <Trash2 size={12} /> Remover
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="page-card overflow-x-auto">
          <table className="schedule-table">
            <thead><tr><th className="text-left">Nome</th><th className="text-left">WhatsApp</th><th className="text-left">Categoria</th><th className="text-left">Unidade</th><th className="text-right">Ações</th></tr></thead>
            <tbody>
              {filtered.map(emp => (
                <tr key={emp.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setDetailEmp(emp)}>
                  <td className="font-medium">{emp.name}</td>
                  <td className="text-xs text-muted-foreground">{(isAdmin || isRH || isChief || isManager) && emp.phone ? emp.phone : '—'}</td>
                  <td>{getCat(emp.category_id)?.name ?? '—'}</td>
                  <td>{getUnitName(emp.unit_id)}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDetailEmp(emp); }}><Eye size={16} /></Button>
                      {canEdit && <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(emp); }}><Pencil size={16} /></Button>}
                      {canDelete && <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(emp.id, emp.name); }}><Trash2 size={16} className="text-destructive" /></Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
