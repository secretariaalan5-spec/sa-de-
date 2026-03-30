import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Building2 } from 'lucide-react';

interface Unit { id: string; name: string; active: boolean; }

export default function Units() {
  const { roleInfo } = useAuthContext();
  const [units, setUnits] = useState<Unit[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  const load = async () => {
    const { data } = await supabase.from('units').select('*').order('name');
    setUnits(data ?? []);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!name.trim()) return;

    const { error } = await supabase.from('units').insert({
      name: name.trim(),
      team_id: roleInfo?.team_id,
    });

    if (error) {
      console.error('Unit insert error');
      toast.error('Erro ao criar unidade.');
      return;
    }
    toast.success('Unidade criada!');
    setName('');
    setOpen(false);
    load();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Unidades</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus size={16} /> Nova Unidade</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Unidade</DialogTitle><DialogDescription>Cadastre uma nova unidade no sistema.</DialogDescription></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full">Criar</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {units.length === 0 ? (
        <div className="empty-state">
          <Building2 className="mx-auto mb-3 text-muted-foreground" size={40} />
          <p className="text-muted-foreground">Nenhuma unidade cadastrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {units.map(u => (
            <div key={u.id} className="page-card flex items-center gap-3">
              <Building2 size={20} className="text-primary" />
              <span className="font-medium">{u.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
