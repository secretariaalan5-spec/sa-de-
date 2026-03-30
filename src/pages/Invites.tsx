import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Mail, Copy, Trash2, Users, UserCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface Invite {
  id: string;
  token: string;
  role: string;
  used: boolean;
  created_at: string;
  category_id: string | null;
  unit_id: string | null;
  used_by: string | null;
}

interface Category { id: string; name: string; }
interface Unit { id: string; name: string; }

interface UserWithRole {
  id: string;
  user_id: string;
  role: string;
  category_id: string | null;
  unit_id: string | null;
  created_at: string;
}

interface Profile {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
}

export default function Invites() {
  const { roleInfo, isAdmin } = useAuthContext();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [userRoles, setUserRoles] = useState<UserWithRole[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState('unit_manager');
  const [categoryId, setCategoryId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [activeTab, setActiveTab] = useState('invites');
  const [searchUsers, setSearchUsers] = useState('');

  const load = async () => {
    const [i, c, u] = await Promise.all([
      supabase.from('invites').select('*').order('created_at', { ascending: false }),
      supabase.from('categories').select('id, name'),
      supabase.from('units').select('id, name'),
    ]);
    setInvites(i.data ?? []);
    setCategories(c.data ?? []);
    setUnits(u.data ?? []);

    // Load all users with roles (admin only)
    if (isAdmin) {
      const { data: roles } = await supabase.from('user_roles').select('*').order('created_at', { ascending: false });
      setUserRoles(roles ?? []);

      if (roles && roles.length > 0) {
        const userIds = roles.map((r: any) => r.user_id);
        const { data: profs } = await supabase.from('profiles').select('user_id, display_name, avatar_url').in('user_id', userIds);
        setProfiles(profs ?? []);
      }
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (ev: React.FormEvent) => {
    ev.preventDefault();

    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('invites').insert({
      role,
      team_id: roleInfo?.team_id,
      category_id: role === 'category_chief' ? categoryId || null : null,
      unit_id: role === 'unit_manager' ? unitId || null : null,
      created_by: user?.id ?? null,
    });

    if (error) {
      toast.error('Erro ao criar convite.');
      return;
    }
    toast.success('Convite criado!');
    setOpen(false);
    setRole('unit_manager');
    setCategoryId('');
    setUnitId('');
    load();
  };

  const handleDeleteInvite = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este convite?')) return;
    const { error } = await supabase.from('invites').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir convite.');
      return;
    }
    toast.success('Convite excluído!');
    load();
  };

  const handleRemoveUser = async (userId: string, userName: string) => {
    if (!confirm(`Tem certeza que deseja remover o acesso de "${userName}"? O usuário não poderá mais acessar o sistema.`)) return;
    const { error } = await supabase.from('user_roles').delete().eq('user_id', userId);
    if (error) {
      toast.error('Erro ao remover usuário.');
      return;
    }
    toast.success('Acesso removido!');
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
    professional: 'Profissional',
  };

  const getProfileName = (userId: string) => {
    const p = profiles.find(p => p.user_id === userId);
    return p?.display_name || userId.substring(0, 8) + '...';
  };

  const getCatName = (id: string | null) => categories.find(c => c.id === id)?.name ?? '';
  const getUnitName = (id: string | null) => units.find(u => u.id === id)?.name ?? '';

  const filteredUsers = userRoles.filter(ur => {
    if (!searchUsers) return true;
    const name = getProfileName(ur.user_id).toLowerCase();
    const roleName = (roleLabels[ur.role] ?? ur.role).toLowerCase();
    return name.includes(searchUsers.toLowerCase()) || roleName.includes(searchUsers.toLowerCase());
  });

  const usedInvites = invites.filter(i => i.used).length;
  const availableInvites = invites.filter(i => !i.used).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Convites & Participantes</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus size={16} /> Novo Convite</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Convite</DialogTitle><DialogDescription>Gere um link de convite para novo usuário.</DialogDescription></DialogHeader>
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

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-primary">{availableInvites}</p>
          <p className="text-xs text-muted-foreground">Disponíveis</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold">{usedInvites}</p>
          <p className="text-xs text-muted-foreground">Usados</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-accent-foreground">{userRoles.length}</p>
          <p className="text-xs text-muted-foreground">Participantes</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-2">
          <TabsTrigger value="invites" className="gap-1"><Mail size={14} /> Convites ({invites.length})</TabsTrigger>
          <TabsTrigger value="users" className="gap-1"><Users size={14} /> Participantes ({userRoles.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="invites" className="mt-4">
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
                    <th className="text-left">Escopo</th>
                    <th className="text-left">Status</th>
                    <th className="text-left">Criado em</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {invites.map(inv => (
                    <tr key={inv.id}>
                      <td><Badge variant="secondary">{roleLabels[inv.role] || inv.role}</Badge></td>
                      <td className="text-sm text-muted-foreground">
                        {inv.category_id ? getCatName(inv.category_id) : inv.unit_id ? getUnitName(inv.unit_id) : '—'}
                      </td>
                      <td>
                        <Badge variant={inv.used ? 'default' : 'secondary'}>
                          {inv.used ? 'Usado' : 'Disponível'}
                        </Badge>
                      </td>
                      <td className="text-sm">{new Date(inv.created_at).toLocaleDateString('pt-BR')}</td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          {!inv.used && (
                            <Button variant="ghost" size="sm" onClick={() => copyLink(inv.token)} className="gap-1">
                              <Copy size={14} /> Copiar
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteInvite(inv.id)} className="h-8 w-8">
                            <Trash2 size={14} className="text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="users" className="mt-4 space-y-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Buscar participante..."
              value={searchUsers}
              onChange={e => setSearchUsers(e.target.value)}
              className="pl-9"
            />
          </div>

          {filteredUsers.length === 0 ? (
            <div className="empty-state">
              <Users className="mx-auto mb-3 text-muted-foreground" size={40} />
              <p className="text-muted-foreground">Nenhum participante encontrado</p>
            </div>
          ) : (
            <div className="page-card overflow-x-auto">
              <table className="schedule-table">
                <thead>
                  <tr>
                    <th className="text-left">Usuário</th>
                    <th className="text-left">Nível</th>
                    <th className="text-left">Escopo</th>
                    <th className="text-left">Desde</th>
                    <th className="text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(ur => {
                    const name = getProfileName(ur.user_id);
                    return (
                      <tr key={ur.id}>
                        <td>
                          <div className="flex items-center gap-2">
                            <UserCircle size={18} className="text-muted-foreground" />
                            <span className="font-medium text-sm">{name}</span>
                          </div>
                        </td>
                        <td><Badge variant="secondary">{roleLabels[ur.role] || ur.role}</Badge></td>
                        <td className="text-sm text-muted-foreground">
                          {ur.category_id ? getCatName(ur.category_id) : ur.unit_id ? getUnitName(ur.unit_id) : '—'}
                        </td>
                        <td className="text-sm">{new Date(ur.created_at).toLocaleDateString('pt-BR')}</td>
                        <td className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleRemoveUser(ur.user_id, name)}
                          >
                            <Trash2 size={14} className="text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
