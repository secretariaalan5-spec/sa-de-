import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Mail, Copy } from 'lucide-react';

interface Invite {
  id: string;
  token: string;
  role: string;
  used: boolean;
  created_at: string;
  category_id: string | null;
  unit_id: string | null;
}

interface Category { id: string; name: string; }
interface Unit { id: string; name: string; }

export default function Invites() {
  const { roleInfo } = useAuthContext();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState('unit_manager');
  const [categoryId, setCategoryId] = useState('');
  const [unitId, setUnitId] = useState('');

  const load = async () => {
    const [i, c, u] = await Promise.all([
      supabase.from('invites').select('*').order('created_at', { ascending: false }),
      supabase.from('categories').select('id, name'),
      supabase.from('units').select('id, name'),
    ]);
    setInvites(i.data ?? []);
    setCategories(c.data ?? []);
    setUnits(u.data ?? []);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (ev: React.FormEvent) => {
    ev.preventDefault();

    const { error } = await supabase.from('invites').insert({
      role,
      team_id: roleInfo?.team_id,
      category_id: role === 'category_chief' ? categoryId || null : null,
      unit_id: role === 'unit_manager' ? unitId || null : null,
      created_by: null,
    });

    if (error) { toast.error(error.message); return; }
    toast.success('Convite criado!');
    setOpen(false);
    setRole('unit_manager');
    setCategoryId('');
    setUnitId('');
    load();
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/registro?token=${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const roleLabels: Record<string, string> = {
    admin: 'Admin',
    rh: 'RH',
    category_chief: 'Chefe',
    unit_manager: 'Gerente',
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Convites</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus size={16} /> Novo Convite</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Convite</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nível de acesso</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrador</SelectItem>
                    <SelectItem value="rh">RH</SelectItem>
                    <SelectItem value="category_chief">Chefe de Categoria</SelectItem>
                    <SelectItem value="unit_manager">Gerente de Unidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {role === 'category_chief' && (
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
              )}

              {role === 'unit_manager' && (
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
              )}

              <Button type="submit" className="w-full">Criar Convite</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {invites.length === 0 ? (
        <div className="empty-state">
          <Mail className="mx-auto mb-3 text-muted-foreground" size={40} />
          <p className="text-muted-foreground">Nenhum convite criado</p>
        </div>
      ) : (
        <div className="page-card overflow-x-auto">
          <table className="schedule-table">
            <thead>
              <tr>
                <th className="text-left">Nível</th>
                <th className="text-left">Status</th>
                <th className="text-left">Criado em</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {invites.map(inv => (
                <tr key={inv.id}>
                  <td><Badge variant="secondary">{roleLabels[inv.role] || inv.role}</Badge></td>
                  <td>
                    <Badge variant={inv.used ? 'default' : 'secondary'}>
                      {inv.used ? 'Usado' : 'Disponível'}
                    </Badge>
                  </td>
                  <td>{new Date(inv.created_at).toLocaleDateString('pt-BR')}</td>
                  <td className="text-right">
                    {!inv.used && (
                      <Button variant="ghost" size="sm" onClick={() => copyLink(inv.token)} className="gap-1">
                        <Copy size={14} /> Copiar Link
                      </Button>
                    )}
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
