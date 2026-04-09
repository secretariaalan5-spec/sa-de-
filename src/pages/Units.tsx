import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useDataSubscription } from '@/hooks/useDataSubscription';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Building2, Pencil, Trash2 } from 'lucide-react';
import { UnitDetailDialog } from '@/components/UnitDetailDialog';

interface Unit { id: string; name: string; active: boolean; }

export default function Units() {
  const { roleInfo, isAdmin } = useAuthContext();
  const [units, setUnits] = useState<Unit[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUnit, setEditUnit] = useState<Unit | null>(null);
  const [name, setName] = useState('');
  
  // Detail Dialog State
  const [detailUnit, setDetailUnit] = useState<Unit | null>(null);

  const load = async () => {
    if (!roleInfo?.team_id) return;
    const { data } = await supabase.from('units').select('*').eq('team_id', roleInfo.team_id).order('name');
    setUnits(data ?? []);
  };

  useEffect(() => { load(); }, []);
  useDataSubscription(['units'], load);

  const handleAdd = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!name.trim()) return;
    const { error } = await supabase.from('units').insert({ name: name.trim(), team_id: roleInfo?.team_id });
    if (error) { toast.error('Erro ao criar unidade.'); return; }
    toast.success('Unidade criada!');
    setName(''); setOpen(false); load();
  };

  const openEditDialog = (ev: React.MouseEvent, u: Unit) => {
    ev.stopPropagation();
    setEditUnit(u); setName(u.name); setEditOpen(true);
  };

  const handleEdit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!editUnit || !name.trim()) return;
    const { error } = await supabase.from('units').update({ name: name.trim() }).eq('id', editUnit.id);
    if (error) { toast.error('Erro ao atualizar unidade.'); return; }
    toast.success('Unidade atualizada!');
    setEditOpen(false); setEditUnit(null); setName(''); load();
  };

  const handleDelete = async (ev: React.MouseEvent, id: string) => {
    ev.stopPropagation();
    if (!confirm('Tem certeza que deseja remover esta unidade?')) return;
    const { error } = await supabase.from('units').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover unidade. Verifique se não há profissionais vinculados.'); return; }
    toast.success('Unidade removida!'); load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Unidades</h1>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus size={16} /> Nova Unidade</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Unidade</DialogTitle><DialogDescription>Cadastre uma nova unidade no sistema.</DialogDescription></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-1.5"><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
                <Button type="submit" className="w-full">Criar</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Unidade</DialogTitle><DialogDescription>Atualize o nome da unidade.</DialogDescription></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
            <Button type="submit" className="w-full">Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>
      
      {/* Detail Dialog */}
      <UnitDetailDialog 
        open={!!detailUnit} 
        onOpenChange={(op) => !op && setDetailUnit(null)} 
        unitId={detailUnit?.id ?? null} 
        unitName={detailUnit?.name ?? ''} 
      />

      {units.length === 0 ? (
        <div className="empty-state">
          <Building2 className="mx-auto mb-3 text-muted-foreground" size={40} />
          <p className="text-muted-foreground">Nenhuma unidade cadastrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {units.map(u => (
            <div key={u.id} onClick={() => setDetailUnit(u)} className="page-card p-4 hover:border-primary/30 transition-all flex items-center justify-between group shadow-sm cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm border border-border/50 bg-primary/10">
                  <Building2 size={16} className="text-primary" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-foreground text-sm tracking-tight">{u.name}</span>
                  <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">Unidade</span>
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors" onClick={(e) => openEditDialog(e, u)}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0" onClick={(e) => handleDelete(e, u.id)}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
