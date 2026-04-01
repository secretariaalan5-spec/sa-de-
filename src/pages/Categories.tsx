import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useDataSubscription } from '@/hooks/useDataSubscription';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Tag, Pencil, Trash2 } from 'lucide-react';

interface Category { id: string; name: string; slug: string; color: string; }

export default function Categories() {
  const { roleInfo, isAdmin } = useAuthContext();
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editCat, setEditCat] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');

  const load = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    setCategories(data ?? []);
  };

  useEffect(() => { load(); }, []);
  useDataSubscription(['categories'], load);

  const handleAdd = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!name.trim()) return;
    const slug = name.trim().toLowerCase().replace(/\s+/g, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const { error } = await supabase.from('categories').insert({ name: name.trim(), slug, color, team_id: roleInfo?.team_id });
    if (error) { toast.error('Erro ao criar categoria.'); return; }
    toast.success('Categoria criada!');
    setName(''); setColor('#6366f1'); setOpen(false); load();
  };

  const openEditDialog = (c: Category) => {
    setEditCat(c); setName(c.name); setColor(c.color); setEditOpen(true);
  };

  const handleEdit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!editCat || !name.trim()) return;
    const slug = name.trim().toLowerCase().replace(/\s+/g, '_').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const { error } = await supabase.from('categories').update({ name: name.trim(), slug, color }).eq('id', editCat.id);
    if (error) { toast.error('Erro ao atualizar categoria.'); return; }
    toast.success('Categoria atualizada!');
    setEditOpen(false); setEditCat(null); setName(''); load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover esta categoria?')) return;
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover categoria. Verifique se não há profissionais vinculados.'); return; }
    toast.success('Categoria removida!'); load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Categorias</h1>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus size={16} /> Nova Categoria</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova Categoria</DialogTitle><DialogDescription>Cadastre uma nova categoria profissional.</DialogDescription></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-1.5"><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Enfermeiros" required /></div>
                <div className="space-y-1.5"><Label>Cor</Label><Input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-10 w-20" /></div>
                <Button type="submit" className="w-full">Criar</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Categoria</DialogTitle><DialogDescription>Atualize os dados da categoria.</DialogDescription></DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={name} onChange={e => setName(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label>Cor</Label><Input type="color" value={color} onChange={e => setColor(e.target.value)} className="h-10 w-20" /></div>
            <Button type="submit" className="w-full">Salvar</Button>
          </form>
        </DialogContent>
      </Dialog>

      {categories.length === 0 ? (
        <div className="empty-state">
          <Tag className="mx-auto mb-3 text-muted-foreground" size={40} />
          <p className="text-muted-foreground">Nenhuma categoria cadastrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(c => (
            <div key={c.id} className="page-card flex items-center gap-3">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="font-medium flex-1">{c.name}</span>
              {isAdmin && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(c)}>
                    <Pencil size={14} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(c.id)}>
                    <Trash2 size={14} className="text-destructive" />
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
