import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useDataSubscription } from '@/hooks/useDataSubscription';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Users, Pencil, Search, LayoutGrid, List, Trash2, Eye, Phone, MapPin, Wallet, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import EmployeeDetailDialog from '@/components/EmployeeDetailDialog';
import WhatsAppIcon from '@/components/WhatsAppIcon';
import { toast } from 'sonner';

const getWhatsAppLink = (phone: string) => {
  const clean = phone.replace(/\D/g, '');
  return `https://wa.me/${clean.startsWith('55') ? clean : '55' + clean}`;
};

interface Employee {
  id: string; name: string; category_id: string | null;
  unit_id: string | null; active: boolean; team_id: string;
  phone?: string | null;
}
interface Category { id: string; name: string; color: string; }
interface Unit { id: string; name: string; }
interface Credit { employee_id: string; amount: number; }

export default function Employees() {
  const { roleInfo, isAdmin, isManager, isChief, isRH } = useAuthContext();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Credit Adjustment State
  const [adjustEmp, setAdjustEmp] = useState<Employee | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjustType, setAdjustType] = useState<'credit' | 'debit'>('credit');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const adjustOpen = !!adjustEmp;

  const openAdjust = (emp: Employee, e: React.MouseEvent) => {
    e.stopPropagation();
    setAdjustEmp(emp);
    setAdjustAmount('');
    setAdjustNotes('');
    setAdjustType('credit');
  };

  const getBalance = (empId: string) =>
    credits.filter(cr => cr.employee_id === empId).reduce((s, cr) => s + cr.amount, 0);

  const canAdd = isAdmin || isManager;
  const canEdit = isAdmin || isChief || isManager;
  const canDelete = isAdmin || isManager;

  const load = async () => {
    if (!roleInfo?.team_id) return;
    const teamId = roleInfo.team_id;

    let employeesQuery = supabase.from('employees').select('*').eq('active', true).eq('team_id', teamId).order('name');
    
    // Segregação de Dados:
    if (isChief && !isAdmin && !isRH && roleInfo?.category_ids?.length) {
      employeesQuery = employeesQuery.in('category_id', roleInfo.category_ids);
    }
    if (isManager && !isAdmin && !isRH && roleInfo?.unit_id) {
      employeesQuery = employeesQuery.eq('unit_id', roleInfo.unit_id);
    }

    const [e, c, u, cr] = await Promise.all([
      employeesQuery,
      supabase.from('categories').select('id, name, color').eq('active', true).eq('team_id', teamId),
      supabase.from('units').select('id, name').eq('active', true).eq('team_id', teamId),
      supabase.from('leave_credits').select('employee_id, amount').eq('team_id', teamId),
    ]);
    
    let fetchedCategories = c.data ?? [];
    // Filtramos no frontend para que o Chief apenas veja a categoria dele no combobox
    if (isChief && !isAdmin && !isRH && roleInfo?.category_ids?.length) {
      fetchedCategories = fetchedCategories.filter(cat => roleInfo.category_ids?.includes(cat.id));
    }

    setEmployees(e.data ?? []);
    setCategories(fetchedCategories);
    setUnits(u.data ?? []);
    setCredits(cr.data ?? []);
  };

  useEffect(() => { load(); }, []);
  useDataSubscription(['employees', 'categories', 'units', 'leave_credits'], load);

  const handleAdjustCredit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!adjustEmp || isAdjusting) return;

    // Reject if "Outro" was clicked but no value entered yet
    const rawAmount = adjustAmount === 'custom' ? '' : adjustAmount;
    const amount = parseFloat(rawAmount);

    if (isNaN(amount) || amount <= 0) {
      toast.error('Selecione ou digite uma quantidade de dias válida.');
      return;
    }
    // Security: only allow multiples of 0.5 (e.g., 0.5, 1, 1.5, 2...)
    if ((amount * 2) % 1 !== 0) {
      toast.error('Apenas valores múltiplos de 0,5 são permitidos (ex: 1, 1,5, 2, 2,5).');
      return;
    }
    if (!adjustNotes.trim()) { toast.error('O campo Motivo é obrigatório.'); return; }
    if (!roleInfo?.team_id) return;

    const finalAmount = adjustType === 'credit' ? amount : -amount;
    const currentBalance = getBalance(adjustEmp.id);

    // Client-side guard: prevent obviously invalid submissions
    if (finalAmount < 0 && (currentBalance + finalAmount) < 0) {
      toast.error(`Saldo insuficiente. Saldo atual: ${fmtCredit(currentBalance)} dia(s). Não é possível estornar ${fmtCredit(amount)}.`);
      return;
    }

    setIsAdjusting(true);
    try {
      const { error } = await supabase.from('leave_credits').insert({
        team_id: roleInfo.team_id,
        employee_id: adjustEmp.id,
        amount: finalAmount,
        origin: 'initial_balance',
        notes: adjustNotes.trim(),
      });
      if (error) {
        // The DB trigger provides a user-friendly message
        toast.error(error.message?.replace('new row for relation "leave_credits" violates', '').trim() || 'Erro ao lançar ajuste.');
        return;
      }
      toast.success(`Ajuste de ${adjustType === 'credit' ? '+' : '-'}${fmtCredit(amount)} dia(s) lançado para ${adjustEmp.name}!`);
      setAdjustEmp(null);
      load();
    } finally {
      setIsAdjusting(false);
    }
  };

  const handleAdd = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!name.trim() || isSubmitting) return;
    if (!roleInfo?.team_id) {
      toast.error('Permissões ainda não carregadas. Recarregue a página e tente novamente.');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('employees').insert({
        name: name.trim(),
        phone: phone.trim() || null,
        category_id: categoryId || null,
        unit_id: isManager ? (roleInfo.unit_id ?? null) : (unitId || null),
        team_id: roleInfo.team_id,
      });
      if (error) { toast.error(error.message || 'Erro ao cadastrar funcionário.'); return; }
      const addedName = name.trim();
      setOpen(false);
      toast.success(`Profissional "${addedName}" cadastrado com sucesso!`);
      setName(''); setPhone(''); setCategoryId(''); setUnitId(''); load();
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEdit = (emp: Employee) => {
    setEditEmp(emp); setName(emp.name); setPhone(emp.phone ?? ''); setCategoryId(emp.category_id ?? ''); setUnitId(emp.unit_id ?? ''); setEditOpen(true);
  };

  const handleEdit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!editEmp || !name.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const updateData: any = { name: name.trim(), phone: phone.trim() || null };
      if (isAdmin || isChief) { updateData.category_id = categoryId || null; updateData.unit_id = unitId || null; }
      const { error } = await supabase.from('employees').update(updateData).eq('id', editEmp.id);
      if (error) { toast.error('Erro ao atualizar funcionário.'); return; }

      // Se a unidade mudou, registrar em transfer_history
      const newUnitId = unitId || null;
      const oldUnitId = editEmp.unit_id || null;
      const updatedName = name.trim();
      setEditOpen(false);
      if (newUnitId !== oldUnitId && (isAdmin || isChief)) {
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        await supabase.from('transfer_history').insert({
          employee_id: editEmp.id,
          from_unit_id: oldUnitId,
          to_unit_id: newUnitId,
          team_id: roleInfo?.team_id,
          transferred_by: currentUser?.id ?? null,
        });
        toast.success(`Profissional "${updatedName}" atualizado e transferência registrada!`);
      } else {
        toast.success(`Profissional "${updatedName}" atualizado com sucesso!`);
      }
      setEditEmp(null); setName(''); setPhone(''); setCategoryId(''); setUnitId(''); load();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, empName: string) => {
    if (!confirm(`Tem certeza que deseja remover o profissional "${empName}"?\n\nIsso também apagará todas as folgas, escalas, transferências e créditos associados.`)) return;

    // Sequência controlada de exclusão para evitar erros de trigger/saldo
    try {
      // 1. Remove pedidos de folga e histórico
      await supabase.from('leave_requests').delete().eq('employee_id', id);
      await supabase.from('transfer_history').delete().eq('employee_id', id);
      
      // 2. Remove créditos primeiro (importante para o trigger de delete das escalas)
      await supabase.from('leave_credits').delete().eq('employee_id', id);
      
      // 3. Remove as escalas agora que os créditos sumiram
      await supabase.from('schedules').delete().eq('employee_id', id);

      const { error } = await supabase.from('employees').update({ active: false }).eq('id', id);
      if (error) { toast.error('Erro ao desativar profissional.'); return; }
      
      toast.success('Profissional removido e dados relacionados apagados!');
      load();
    } catch (err) {
      console.error('Erro na deleção cascade:', err);
      toast.error('Ocorreu um erro ao remover todos os dados. Verifique as escalas.');
    }
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

  const showCategoryFilter = isAdmin || isRH || isManager || (isChief && (roleInfo?.category_ids?.length ?? 0) > 1);
  const showUnitFilter = isAdmin || isRH || isChief;

  const fmtCredit = (n: number) => n % 1 === 0 ? n.toString() : n.toFixed(1).replace('.', ',');

  const memoizedCards = useMemo(() => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {filtered.map(emp => {
        const cat = getCat(emp.category_id);
        const empCredits = credits.filter(cr => cr.employee_id === emp.id);
        const balance = empCredits.reduce((s, cr) => s + cr.amount, 0);
        
        return (
          <div 
            key={emp.id} 
            className="prof-card-simple group relative overflow-hidden" 
            style={{ 
              backgroundColor: cat ? `${cat.color}40` : undefined,
              borderColor: cat ? `${cat.color}90` : undefined
            }}
            onClick={() => setDetailEmp(emp)}
          >
            {/* Camada de brilho/contraste para não ofuscar o texto */}
            <div className="absolute inset-0 bg-white/40 pointer-events-none" />
            
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-2">
                <p className="font-bold text-base text-foreground tracking-tight truncate pr-2">{emp.name}</p>
                <Badge 
                  variant={balance > 0 ? 'default' : balance < 0 ? 'destructive' : 'secondary'}
                  className="font-mono text-[10px] shadow-sm shrink-0"
                >
                  {balance > 0 ? `+${fmtCredit(balance)}` : fmtCredit(balance)}
                </Badge>
              </div>
              
              <div className="flex flex-wrap gap-1.5 mb-3">
                {cat && (
                  <span 
                    className="text-[10px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded-md border shadow-sm"
                    style={{ 
                      backgroundColor: 'white', 
                      borderColor: `${cat.color}40`,
                      color: cat.color 
                    }}
                  >
                    {cat.name}
                  </span>
                )}
              </div>

              <div className="space-y-2.5 mb-4">
                <div className="flex items-center gap-2 text-foreground/80">
                  <div className="w-5 h-5 rounded-md bg-white/50 flex items-center justify-center border border-black/5">
                    <MapPin size={10} className="shrink-0" />
                  </div>
                  <span className="text-[11px] font-bold truncate">{getUnitName(emp.unit_id)}</span>
                </div>
                
                {emp.phone && (
                  <div className="pt-0.5">
                    <a
                      href={getWhatsAppLink(emp.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-green-500/30 text-green-600 font-extrabold hover:bg-green-50 shadow-sm transition-all text-[11px]"
                    >
                      <WhatsAppIcon size={12} className="shrink-0 text-green-500" />
                      {emp.phone}
                    </a>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-black/10 flex items-center justify-between">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={(e) => { e.stopPropagation(); setDetailEmp(emp); }} 
                  className="h-7 px-2 text-[11px] font-bold text-foreground/70 hover:text-primary hover:bg-white/50 transition-all"
                >
                  <Eye size={14} className="mr-1.5" /> Histórico
                </Button>
                
                <div className="flex items-center gap-0.5">
                  {canEdit && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={(e) => { e.stopPropagation(); openEdit(emp); }} 
                      className="h-8 w-8 text-foreground/60 hover:text-primary hover:bg-white/50"
                    >
                      <Pencil size={14} />
                    </Button>
                  )}
                  {isAdmin && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      title="Ajustar Saldo de Folgas"
                      onClick={(e) => openAdjust(emp, e)}
                      className="h-8 w-8 text-foreground/60 hover:text-emerald-600 hover:bg-white/50"
                    >
                      <Wallet size={14} />
                    </Button>
                  )}
                  {canDelete && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={(e) => { e.stopPropagation(); handleDelete(emp.id, emp.name); }} 
                      className="h-8 w-8 text-foreground/60 hover:text-destructive hover:bg-white/50"
                    >
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  ), [filtered, categories, units, credits, canEdit, canDelete]);

  const memoizedTable = useMemo(() => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-muted/40 text-xs uppercase text-muted-foreground border-b border-border">
          <tr>
            <th className="px-5 py-4 font-semibold">Nome</th>
            <th className="px-5 py-4 font-semibold">WhatsApp</th>
            <th className="px-5 py-4 font-semibold">Categoria</th>
            <th className="px-5 py-4 font-semibold">Unidade</th>
            <th className="px-5 py-4 font-semibold">Saldo</th>
            <th className="px-5 py-4 font-semibold text-right">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {filtered.map(emp => (
            <tr key={emp.id} className="group hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setDetailEmp(emp)}>
              <td className="px-5 py-3.5 font-medium text-foreground">{emp.name}</td>
              <td className="px-5 py-3.5">
                {(isAdmin || isRH || isChief || isManager) && emp.phone ? (
                  <a
                    href={getWhatsAppLink(emp.phone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title="Abrir conversa no WhatsApp"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 font-medium hover:bg-green-500/20 hover:border-green-500/40 hover:shadow-sm transition-all duration-200"
                  >
                    <WhatsAppIcon size={14} />
                    <span className="text-xs">{emp.phone}</span>
                  </a>
                ) : (
                  <span className="text-muted-foreground text-xs">—</span>
                )}
              </td>
              <td className="px-5 py-3.5 text-muted-foreground">
                {getCat(emp.category_id) ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border" style={{ backgroundColor: `${getCat(emp.category_id)?.color}15`, borderColor: `${getCat(emp.category_id)?.color}30`, color: getCat(emp.category_id)?.color }}>
                    {getCat(emp.category_id)?.name}
                  </span>
                ) : '—'}
              </td>
              <td className="px-5 py-3.5 text-muted-foreground">{getUnitName(emp.unit_id)}</td>
              <td className="px-5 py-3.5">
                {(() => {
                  const empCredits = credits.filter(cr => cr.employee_id === emp.id);
                  const balance = empCredits.reduce((s, cr) => s + cr.amount, 0);
                  return (
                    <span className={cn(
                      "font-bold",
                      balance > 0 ? "text-emerald-600" : 
                      balance < 0 ? "text-rose-600" : 
                      "text-slate-400"
                    )}>
                      {fmtCredit(balance)}
                    </span>
                  );
                })()}
              </td>
              <td className="px-5 py-3.5 text-right">
                <div className="flex justify-end gap-1 opacity-100 sm:opacity-50 sm:group-hover:opacity-100 transition-opacity">
                   <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors" onClick={(e) => { e.stopPropagation(); setDetailEmp(emp); }}><Eye size={14} /></Button>
                  {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors" onClick={(e) => { e.stopPropagation(); openEdit(emp); }}><Pencil size={14} /></Button>}
                  {isAdmin && <Button variant="ghost" size="icon" title="Ajustar Saldo" className="h-8 w-8 hover:bg-emerald-500/10 hover:text-emerald-600 transition-colors" onClick={(e) => openAdjust(emp, e)}><Wallet size={14} /></Button>}
                  {canDelete && <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={(e) => { e.stopPropagation(); handleDelete(emp.id, emp.name); }}><Trash2 size={14} /></Button>}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ), [filtered, categories, units, credits, canEdit, canDelete]);

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
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? 'Cadastrando...' : 'Cadastrar'}
                </Button>
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
        {showCategoryFilter && (
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Categorias</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {showUnitFilter && (
          <Select value={filterUnit} onValueChange={setFilterUnit}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Unidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Unidades</SelectItem>
              {units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <div className="hidden sm:flex bg-muted rounded-lg p-0.5">
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
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </Button>
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

      {/* Credit Adjustment Dialog */}
      <Dialog open={adjustOpen} onOpenChange={(o) => { if (!o) setAdjustEmp(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet size={18} className="text-emerald-600" />
              Ajustar Saldo de Folgas
            </DialogTitle>
            <DialogDescription>
              Lançamento para <strong>{adjustEmp?.name}</strong>. Todos os ajustes são rastreados por auditoria.
            </DialogDescription>
          </DialogHeader>

          {adjustEmp && (() => {
            const currentBalance = getBalance(adjustEmp.id);
            const parsedAmount = adjustAmount === 'custom' ? 0 : (parseFloat(adjustAmount) || 0);
            const delta = adjustType === 'credit' ? parsedAmount : -parsedAmount;
            const newBalance = currentBalance + delta;
            const isNegativeResult = newBalance < 0;

            return (
              <form onSubmit={handleAdjustCredit} className="space-y-4">
                {/* Type selector */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('credit')}
                    className={cn(
                      'flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 transition-all text-sm font-semibold',
                      adjustType === 'credit'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm dark:bg-emerald-950/30'
                        : 'border-border text-muted-foreground hover:border-emerald-300'
                    )}
                  >
                    <span className="text-lg">+</span> Crédito / Saldo Inicial
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('debit')}
                    className={cn(
                      'flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 transition-all text-sm font-semibold',
                      adjustType === 'debit'
                        ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-sm dark:bg-rose-950/30'
                        : 'border-border text-muted-foreground hover:border-rose-300'
                    )}
                  >
                    <span className="text-lg">−</span> Estorno / Correção
                  </button>
                </div>

                {/* Current & preview balance */}
                <div className="flex items-center justify-between rounded-xl bg-muted/50 px-4 py-3 border border-border">
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Saldo Atual</p>
                    <p className={cn('text-xl font-bold', currentBalance > 0 ? 'text-emerald-600' : currentBalance < 0 ? 'text-rose-600' : 'text-slate-400')}>
                      {fmtCredit(currentBalance)}
                    </p>
                  </div>
                  <span className="text-2xl text-muted-foreground">→</span>
                  <div className="text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Novo Saldo</p>
                    <p className={cn('text-xl font-bold', isNegativeResult ? 'text-rose-600' : newBalance > 0 ? 'text-emerald-600' : 'text-slate-400')}>
                      {parsedAmount > 0 ? fmtCredit(newBalance) : '—'}
                    </p>
                  </div>
                </div>

                {isNegativeResult && parsedAmount > 0 && (
                  <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 dark:bg-rose-950/30 dark:border-rose-800">
                    <AlertTriangle size={14} className="shrink-0" />
                    Estorno maior que o saldo disponível. Operação será bloqueada.
                  </div>
                )}

                {/* Amount — chip selector (safest: only valid multiples of 0.5) */}
                <div className="space-y-2">
                  <Label>Quantidade de dias</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {[0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 7, 10, 15, 20].map(v => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setAdjustAmount(String(v))}
                        className={cn(
                          'px-3 py-1.5 rounded-lg border-2 text-sm font-bold transition-all',
                          adjustAmount === String(v)
                            ? adjustType === 'credit'
                              ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm'
                              : 'border-rose-500 bg-rose-500 text-white shadow-sm'
                            : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                        )}
                      >
                        {v % 1 === 0 ? v : v.toFixed(1).replace('.', ',')}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setAdjustAmount('custom')}
                      className={cn(
                        'px-3 py-1.5 rounded-lg border-2 text-sm font-bold transition-all',
                        adjustAmount === 'custom' || (!['0.5','1','1.5','2','2.5','3','4','5','7','10','15','20',''].includes(adjustAmount) && adjustAmount !== 'custom')
                          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                          : 'border-border text-muted-foreground hover:border-primary/40'
                      )}
                    >
                      Outro
                    </button>
                  </div>
                  {/* Custom input — only shown when "Outro" selected */}
                  {(adjustAmount === 'custom' || (!['0.5','1','1.5','2','2.5','3','4','5','7','10','15','20',''].includes(adjustAmount))) && (
                    <div>
                      <Input
                        type="number"
                        min="0.5"
                        step="0.5"
                        placeholder="Ex: 6 ou 8.5 (múltiplo de 0,5)"
                        value={adjustAmount === 'custom' ? '' : adjustAmount}
                        onChange={e => {
                          const val = e.target.value;
                          // Only allow multiples of 0.5
                          const num = parseFloat(val);
                          if (val === '' || (num > 0 && (num * 2) % 1 === 0)) {
                            setAdjustAmount(val || 'custom');
                          }
                        }}
                        className="mt-1"
                        autoFocus
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Apenas múltiplos de 0,5 (ex: 6, 8,5, 12)</p>
                    </div>
                  )}
                </div>

                {/* Notes (required) */}
                <div className="space-y-1.5">
                  <Label>Motivo <span className="text-rose-500">*</span></Label>
                  <Textarea
                    placeholder="Ex: Saldo pré-sistema referente a 2025, autorizado por Diretora Ana."
                    value={adjustNotes}
                    onChange={e => setAdjustNotes(e.target.value)}
                    rows={2}
                    required
                    className="resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground">Este campo é obrigatório e fica registrado para auditoria.</p>
                </div>

                <Button
                  type="submit"
                  className={cn('w-full', adjustType === 'debit' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700')}
                  disabled={isAdjusting || isNegativeResult}
                >
                  {isAdjusting ? 'Lançando...' : adjustType === 'credit' ? `Confirmar Crédito` : `Confirmar Estorno`}
                </Button>
              </form>
            );
          })()}
        </DialogContent>
      </Dialog>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Users className="mx-auto mb-3 text-muted-foreground" size={40} />
          <p className="text-muted-foreground">Nenhum profissional encontrado</p>
        </div>
      ) : (
        <>
          <div className="sm:hidden">
            {memoizedCards}
          </div>
          <div className="hidden sm:block">
            {viewMode === 'cards' ? memoizedCards : (
              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden mt-6">
                {memoizedTable}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
