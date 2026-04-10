import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Plus, Mail, Copy, Trash2, Users, Search, ArrowRightLeft, CheckCircle2, XCircle, Clock, ShieldAlert } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';

interface PendingApproval {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string | null;
  user_avatar: string | null;
  requested_role: string;
  unit_id: string | null;
  category_ids: string[];
  status: string;
  created_at: string;
}

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

interface CategoryInvite {
  id: string;
  token: string;
  admin_id: string;
  category_ids: string[];
  label: string;
  is_active: boolean;
  uses_count: number;
  max_uses: number | null;
  expires_at: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
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
  const [categoryInvites, setCategoryInvites] = useState<CategoryInvite[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [userRoles, setUserRoles] = useState<UserWithRole[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState('unit_manager');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [unitId, setUnitId] = useState('');
  const [activeTab, setActiveTab] = useState('approvals');
  const [searchUsers, setSearchUsers] = useState('');
  const [userUnitFilter, setUserUnitFilter] = useState('all');
  const [userCategoryFilter, setUserCategoryFilter] = useState('all');
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferUserId, setTransferUserId] = useState('');
  const [transferToUnitId, setTransferToUnitId] = useState('');

  const load = async () => {
    if (!roleInfo?.team_id) return;
    const teamId = roleInfo.team_id;
    const [i, ci, c, u] = await Promise.all([
      supabase.from('invites').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
      supabase.from('category_invites').select('*').eq('team_id', teamId).order('created_at', { ascending: false }),
      supabase.from('categories').select('id, name').eq('team_id', teamId),
      supabase.from('units').select('id, name').eq('team_id', teamId),
    ]);

    setInvites(i.data ?? []);
    setCategoryInvites(ci.data ?? []);
    setCategories(c.data ?? []);
    setUnits(u.data ?? []);

    // Load pending approvals
    if (isAdmin) {
      const { data: approvals } = await supabase
        .from('pending_approvals')
        .select('*')
        .order('created_at', { ascending: false });
      setPendingApprovals(approvals ?? []);
    }

    if (!isAdmin) {
      setUserRoles([]);
      setProfiles([]);
      return;
    }

    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: false });

    if (rolesError) {
      toast.error('Erro ao carregar participantes.');
      setUserRoles([]);
      setProfiles([]);
      return;
    }

    setUserRoles(roles ?? []);

    const roleUserIds = (roles ?? []).map((r: any) => r.user_id).filter(Boolean);
    const acceptedUserIds = (ci.data ?? []).map((inv: any) => inv.accepted_by).filter(Boolean);
    const userIds = Array.from(new Set([...roleUserIds, ...acceptedUserIds]));
    if (userIds.length === 0) {
      setProfiles([]);
      return;
    }

    const { data: profs } = await supabase
      .from('profiles')
      .select('user_id, display_name, avatar_url')
      .in('user_id', userIds);

    setProfiles(profs ?? []);
  };

  useEffect(() => {
    load();
  }, [isAdmin]);

  const handleCreate = async (ev: React.FormEvent) => {
    ev.preventDefault();

    if (!roleInfo?.team_id) {
      toast.error('Permissões ainda não carregadas. Recarregue a página e tente novamente.');
      return;
    }

    if (role === 'category_chief' && selectedCategoryIds.length === 0) {
      toast.error('Selecione pelo menos uma categoria para o chefe de categoria.');
      return;
    }

    if (role === 'unit_manager' && !unitId) {
      toast.error('Selecione uma unidade para o gerente.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    // Generate expiration (48 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);

    if (role === 'category_chief') {
      // Gerar token único no frontend (32 caracteres hex)
      const token = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const { error } = await supabase.from('category_invites').insert({
        token: token,
        admin_id: user?.id ?? null,
        category_ids: selectedCategoryIds,
        max_uses: 1,
        expires_at: expiresAt.toISOString(),
      });

      if (error) {
        toast.error(error.message || 'Erro ao criar convite.');
        return;
      }
      toast.success(`Convite criado para ${selectedCategoryIds.length} categoria(s)!`);
    } else {
      // Legacy invites for other roles
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      const { error } = await supabase.from('invites').insert({
        role,
        team_id: roleInfo.team_id,
        category_id: null,
        unit_id: role === 'unit_manager' ? unitId || null : null,
        created_by: user?.id ?? null,
        expires_at: expiresAt.toISOString(), // Expiração forte de 48h
      });
      if (error) {
        toast.error(error.message || 'Erro ao criar convite.');
        return;
      }
      toast.success('Convite criado!');
    }

    setOpen(false);
    setRole('unit_manager');
    setSelectedCategoryIds([]);
    setUnitId('');
    load();
  };

  const handleDeleteInvite = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este convite?')) return;

    const { error } = await supabase.from('invites').delete().eq('id', id);
    if (error) {
      toast.error(error.message || 'Erro ao excluir convite.');
      return;
    }

    toast.success('Convite excluído!');
    load();
  };

  const handleRemoveUser = async (userId: string, userName: string) => {
    if (!confirm(`Tem certeza que deseja REMOVER COMPLETAMENTE "${userName}"? Todos os dados e acesso serão apagados permanentemente.`)) return;

    const { data, error } = await supabase.rpc('remove_user_completely', { p_user_id: userId });
    if (error) {
      toast.error(error.message || 'Erro ao remover usuário.');
      return;
    }
    const result = data as any;
    if (result && !result.success) {
      toast.error(result.error || 'Erro ao remover usuário.');
      return;
    }

    toast.success('Usuário removido completamente do sistema!');
    load();
  };

  const handleTransferManager = async () => {
    if (!transferUserId || !transferToUnitId) return;

    // Update user_roles unit_id
    const { error: roleErr } = await supabase
      .from('user_roles')
      .update({ unit_id: transferToUnitId } as any)
      .eq('user_id', transferUserId)
      .eq('role', 'unit_manager');

    if (roleErr) {
      toast.error('Erro ao transferir gerente.');
      return;
    }

    toast.success('Gerente transferido para nova unidade!');
    setTransferOpen(false);
    setTransferUserId('');
    setTransferToUnitId('');
    load();
  };

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/registro/${token}`;
    await navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const copyCategoryInviteLink = async (token: string) => {
    const url = `${window.location.origin}/convite/${token}`;
    await navigator.clipboard.writeText(url);
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
    const p = profiles.find((profile) => profile.user_id === userId);
    return p?.display_name || userId.substring(0, 8) + '...';
  };

  const getProfileAvatar = (userId: string) => {
    return profiles.find((profile) => profile.user_id === userId)?.avatar_url ?? null;
  };

  const getCatName = (id: string | null) => categories.find((category) => category.id === id)?.name ?? '—';
  const getUnitName = (id: string | null) => units.find((unit) => unit.id === id)?.name ?? '—';

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
      case 'rh': return 'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800';
      case 'category_chief': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      case 'unit_manager': return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
      default: return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  // Group user_roles by user_id for display (chiefs may have multiple rows)
  const groupedUsers = useMemo(() => {
    const map = new Map<string, { user_id: string; role: string; category_ids: string[]; unit_id: string | null; created_at: string }>();
    for (const ur of userRoles) {
      const existing = map.get(ur.user_id);
      if (existing) {
        if (ur.category_id && !existing.category_ids.includes(ur.category_id)) {
          existing.category_ids.push(ur.category_id);
        }
      } else {
        map.set(ur.user_id, {
          user_id: ur.user_id,
          role: ur.role,
          category_ids: ur.category_id ? [ur.category_id] : [],
          unit_id: ur.unit_id,
          created_at: ur.created_at,
        });
      }
    }
    return Array.from(map.values());
  }, [userRoles]);

  const filteredUsers = groupedUsers.filter((u) => {
    const name = getProfileName(u.user_id).toLowerCase();
    const roleName = (roleLabels[u.role] ?? u.role).toLowerCase();
    const searchTerm = searchUsers.toLowerCase();

    if (searchUsers && !name.includes(searchTerm) && !roleName.includes(searchTerm)) return false;
    if (userUnitFilter !== 'all' && u.unit_id !== userUnitFilter) return false;
    if (userCategoryFilter !== 'all' && !u.category_ids.includes(userCategoryFilter)) return false;

    return true;
  });

  const usedInvites = invites.filter((invite) => invite.used).length;
  const availableInvites = invites.filter((invite) => !invite.used).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Convites & Participantes</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus size={16} /> Novo Convite</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Convite</DialogTitle>
              <DialogDescription>Gere um link de convite para novo usuário.</DialogDescription>
            </DialogHeader>
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
                <div className="space-y-2">
                  <Label>Categorias (pode selecionar várias)</Label>
                  <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
                    {categories.map((category) => (
                      <div key={category.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`cat-${category.id}`}
                          checked={selectedCategoryIds.includes(category.id)}
                          onCheckedChange={(checked) => {
                            setSelectedCategoryIds(prev =>
                              checked
                                ? [...prev, category.id]
                                : prev.filter(id => id !== category.id)
                            );
                          }}
                        />
                        <label htmlFor={`cat-${category.id}`} className="text-sm cursor-pointer">{category.name}</label>
                      </div>
                    ))}
                  </div>
                  {selectedCategoryIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">{selectedCategoryIds.length} categoria(s) selecionada(s)</p>
                  )}
                </div>
              )}

              {role === 'unit_manager' && (
                <div className="space-y-1.5">
                  <Label>Unidade</Label>
                  <Select value={unitId} onValueChange={setUnitId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {units.map((unit) => (
                        <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
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

      {/* Pending approvals alert */}
      {pendingApprovals.filter(a => a.status === 'pending').length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 animate-fade-in">
          <ShieldAlert className="text-amber-600 flex-shrink-0" size={24} />
          <div className="flex-1">
            <p className="font-semibold text-amber-800">{pendingApprovals.filter(a => a.status === 'pending').length} solicitação(ões) aguardando aprovação</p>
            <p className="text-xs text-amber-600">Revise as solicitações na aba "Aprovações"</p>
          </div>
          <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100" onClick={() => setActiveTab('approvals')}>Revisar</Button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-amber-500">{pendingApprovals.filter(a => a.status === 'pending').length}</p>
          <p className="text-xs text-muted-foreground">Pendentes</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-primary">{availableInvites}</p>
          <p className="text-xs text-muted-foreground">Disponíveis</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold">{usedInvites}</p>
          <p className="text-xs text-muted-foreground">Usados</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 text-center">
          <p className="text-2xl font-bold text-accent-foreground">{groupedUsers.length}</p>
          <p className="text-xs text-muted-foreground">Participantes</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="approvals" className="gap-1 relative">
            <ShieldAlert size={14} /> Aprovações
            {pendingApprovals.filter(a => a.status === 'pending').length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                {pendingApprovals.filter(a => a.status === 'pending').length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="invites" className="gap-1"><Mail size={14} /> Convites ({invites.length})</TabsTrigger>
          <TabsTrigger value="users" className="gap-1"><Users size={14} /> Equipe ({groupedUsers.length})</TabsTrigger>
        </TabsList>

        {/* ========== APPROVALS TAB ========== */}
        <TabsContent value="approvals" className="mt-4">
          {pendingApprovals.length === 0 ? (
            <div className="empty-state">
              <CheckCircle2 className="mx-auto mb-3 text-muted-foreground" size={40} />
              <p className="text-muted-foreground">Nenhuma solicitação de acesso</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingApprovals.map((approval) => (
                <div key={approval.id} className="page-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 border-l-[3px] transition-all hover:shadow-md" style={{ borderLeftColor: approval.status === 'pending' ? 'var(--warning)' : approval.status === 'approved' ? 'var(--accent)' : 'var(--destructive)' }}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="h-10 w-10 sm:h-12 sm:w-12 border border-border/50 shadow-sm shrink-0">
                      {approval.user_avatar && <AvatarImage src={approval.user_avatar} />}
                      <AvatarFallback className="bg-primary/5 text-primary text-xs sm:text-sm font-bold">
                        {(approval.user_name || approval.user_email || '?').substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-foreground truncate text-sm sm:text-base">{approval.user_name || approval.user_email}</p>
                      <p className="text-[11px] sm:text-xs text-muted-foreground truncate font-medium">{approval.user_email}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <Badge variant="secondary" className="text-[9px] sm:text-[10px] uppercase font-bold tracking-widest bg-secondary/60 text-secondary-foreground">
                          {roleLabels[approval.requested_role] || approval.requested_role}
                        </Badge>
                        {approval.unit_id && <Badge variant="outline" className="text-[9px] sm:text-[10px] font-semibold border-border/60">{getUnitName(approval.unit_id)}</Badge>}
                        {approval.category_ids?.length > 0 && approval.category_ids.map(cid => (
                          <Badge key={cid} variant="outline" className="text-[9px] sm:text-[10px] font-semibold border-border/60">{getCatName(cid)}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col sm:items-end justify-between gap-3 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 mt-2 sm:mt-0">
                     <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                       Solicitado em: {new Date(approval.created_at).toLocaleDateString('pt-BR')}
                     </span>
                     {approval.status === 'pending' ? (
                        <div className="flex gap-2 items-center">
                          <Button size="sm" variant="outline" className="h-8 px-4 text-xs font-bold border-destructive/40 text-destructive hover:bg-destructive hover:text-white transition-colors" onClick={async () => {
                            if (!confirm(`Recusar acesso de ${approval.user_name || approval.user_email}?`)) return;
                            const { data, error } = await supabase.rpc('reject_pending_user', { p_approval_id: approval.id });
                            if (error) { toast.error(error.message); return; }
                            toast.success('Solicitação recusada.');
                            load();
                          }}>
                            Recusar
                          </Button>
                          <Button size="sm" className="h-8 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors" onClick={async () => {
                            const { data, error } = await supabase.rpc('approve_pending_user', { p_approval_id: approval.id });
                            if (error) { toast.error(error.message); return; }
                            toast.success('Usuário aprovado!');
                            load();
                          }}>
                            Aprovar
                          </Button>
                        </div>
                      ) : (
                        <Badge variant={approval.status === 'approved' ? 'default' : 'destructive'} className="uppercase tracking-widest text-[9px] sm:text-[10px]">
                          {approval.status === 'approved' ? 'Aprovado' : 'Recusado'}
                        </Badge>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>



        <TabsContent value="invites" className="mt-4">
          {invites.length === 0 ? (
            <div className="empty-state">
              <Mail className="mx-auto mb-3 text-muted-foreground" size={40} />
              <p className="text-muted-foreground">Nenhum convite criado</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/40 text-muted-foreground border-b border-border/50 uppercase text-[10px] tracking-widest font-bold">
                    <tr>
                      <th className="py-3 px-4">Nível</th>
                      <th className="py-3 px-4">Escopo</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Criado em</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {invites.map((invite) => (
                      <tr key={invite.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="py-3 px-4">
                          <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-widest bg-secondary/60 text-secondary-foreground">{roleLabels[invite.role] || invite.role}</Badge>
                        </td>
                        <td className="py-3 px-4 text-xs font-semibold text-foreground/80">
                          {invite.category_id ? getCatName(invite.category_id) : invite.unit_id ? getUnitName(invite.unit_id) : 'Global / Admin'}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={invite.used ? 'secondary' : 'default'} className="text-[9px] uppercase font-bold tracking-widest">
                            {invite.used ? 'Utilizado' : 'Disponível'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-muted-foreground">{new Date(invite.created_at).toLocaleDateString('pt-BR')}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1 sm:opacity-50 sm:group-hover:opacity-100 transition-opacity">
                            {!invite.used && (
                              <Button variant="ghost" size="sm" onClick={() => copyLink(invite.token)} className="h-8 text-xs font-semibold hover:bg-accent/10 hover:text-accent gap-1.5">
                                <Copy size={14} /> Link
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteInvite(invite.id)} className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive">
                              <Trash2 size={15} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="users" className="mt-4 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Buscar participante..."
                value={searchUsers}
                onChange={(event) => setSearchUsers(event.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={userUnitFilter} onValueChange={setUserUnitFilter}>
              <SelectTrigger className="w-full lg:w-[220px]">
                <SelectValue placeholder="Filtrar por unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as unidades</SelectItem>
                {units.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>{unit.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={userCategoryFilter} onValueChange={setUserCategoryFilter}>
              <SelectTrigger className="w-full lg:w-[220px]">
                <SelectValue placeholder="Filtrar por categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="empty-state">
              <Users className="mx-auto mb-3 text-muted-foreground" size={40} />
              <p className="text-muted-foreground">Nenhum participante encontrado</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/40 text-muted-foreground border-b border-border/50 uppercase text-[10px] tracking-widest font-bold">
                    <tr>
                      <th className="py-3 px-4">Participante</th>
                      <th className="py-3 px-4">Nível de Acesso</th>
                      <th className="py-3 px-4">Unidade Base</th>
                      <th className="py-3 px-4">Data de Ingresso</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {filteredUsers.map((userRole) => {
                      const name = getProfileName(userRole.user_id);
                      return (
                        <tr key={userRole.user_id} className="hover:bg-muted/20 transition-colors group">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8 sm:h-9 sm:w-9 border border-border/50 shrink-0 shadow-sm">
                                {getProfileAvatar(userRole.user_id) && <AvatarImage src={getProfileAvatar(userRole.user_id)!} alt={name} />}
                                <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">{name.substring(0, 2).toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <div className="flex flex-col justify-center">
                                <span className="font-bold text-foreground text-sm">{name}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className={`text-[9px] uppercase font-bold tracking-widest ${getRoleBadgeColor(userRole.role)}`}>
                              {roleLabels[userRole.role] || userRole.role}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-xs font-semibold text-foreground/80">
                            {userRole.unit_id ? getUnitName(userRole.unit_id) : <span className="text-muted-foreground italic font-medium">—</span>}
                          </td>
                          <td className="py-3 px-4 text-xs font-medium text-muted-foreground">{new Date(userRole.created_at).toLocaleDateString('pt-BR')}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1 sm:opacity-50 sm:group-hover:opacity-100 transition-opacity">
                              {userRole.role === 'unit_manager' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 text-xs font-semibold hover:bg-primary/10 hover:text-primary gap-1.5"
                                  title="Transferir para outra unidade"
                                  onClick={() => {
                                    setTransferUserId(userRole.user_id);
                                    setTransferToUnitId('');
                                    setTransferOpen(true);
                                  }}
                                >
                                  <ArrowRightLeft size={14} /> Transferir
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                                title="Remover Usuário Permanentemente"
                                onClick={() => handleRemoveUser(userRole.user_id, name)}
                              >
                                <Trash2 size={15} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Transfer Manager Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transferir Gerente de Unidade</DialogTitle>
            <DialogDescription>
              Mova o gerente <strong>{transferUserId ? getProfileName(transferUserId) : ''}</strong> para outra unidade. Os dados da unidade anterior serão mantidos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Unidade atual</Label>
              <p className="text-sm text-muted-foreground border rounded-md px-3 py-2 bg-muted/30">
                {getUnitName(groupedUsers.find(u => u.user_id === transferUserId)?.unit_id ?? null)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Nova unidade</Label>
              <Select value={transferToUnitId} onValueChange={setTransferToUnitId}>
                <SelectTrigger><SelectValue placeholder="Selecione a unidade destino" /></SelectTrigger>
                <SelectContent>
                  {units
                    .filter(u => u.id !== (groupedUsers.find(gu => gu.user_id === transferUserId)?.unit_id))
                    .map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleTransferManager} className="w-full" disabled={!transferToUnitId}>
              Confirmar Transferência
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
