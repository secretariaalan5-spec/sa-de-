import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppData } from '@/hooks/useAppData';
import { useCategories } from '@/hooks/useCategories';
import { Users, Plus, Pencil, Trash2, Mail, Shield, Clock, UserPlus, Building2, Stethoscope, Copy, Link, Tag } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/untyped-client';
import { UserRole } from '@/hooks/useTeamPermissions';
import { cn } from '@/lib/utils';
import { generateId } from '@/lib/uuid';

interface TeamMemberWithRole {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  role: UserRole;
  category_id: string | null;
  category_name?: string;
  unit_id: string | null;
  unit_name?: string;
  invite_token?: string;
  status?: string;
}

const ROLE_OPTIONS: { value: UserRole; label: string; description: string; icon: typeof Shield }[] = [
  { value: 'admin', label: 'Administrador', description: 'Acesso total ao sistema', icon: Shield },
  { value: 'rh', label: 'RH', description: 'Leitura total, sem edição', icon: Users },
  { value: 'category_chief', label: 'Chefe de Categoria', description: 'Gerencia escalas e folgas da sua categoria', icon: Stethoscope },
  { value: 'unit_manager', label: 'Gerente de Unidade', description: 'Cadastra profissionais da sua unidade', icon: Building2 },
  { value: 'professional', label: 'Profissional', description: 'Visualiza suas escalas e solicita folgas', icon: Users },
];

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-primary/10 text-primary border-primary/20',
  rh: 'bg-blue-500/10 text-blue-600 border-blue-200',
  category_chief: 'bg-amber-500/10 text-amber-600 border-amber-200',
  unit_manager: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
  professional: 'bg-muted text-muted-foreground border-border',
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  rh: 'RH',
  category_chief: 'Chefe de Categoria',
  unit_manager: 'Gerente de Unidade',
  professional: 'Profissional',
};

export default function TeamManagement() {
  const { teamId } = useAppData();
  const { categories } = useCategories();
  const [members, setMembers] = useState<TeamMemberWithRole[]>([]);
  const [pendingInvites, setPendingInvites] = useState<TeamMemberWithRole[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMemberWithRole | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState('');

  // Category management
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#8B5CF6');

  // Form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');

  const fetchMembers = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      // Get user_roles for this team
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('id, user_id, role, category_id, unit_id')
        .eq('team_id', teamId) as any;
      if (error) throw error;

      const userIds = (roles || []).map((r: any) => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      const { data: { user: currentUser } } = await supabase.auth.getUser();

      const membersList: TeamMemberWithRole[] = (roles || []).map((r: any) => {
        const profile = profiles?.find(p => p.user_id === r.user_id);
        const unit = units.find(u => u.id === r.unit_id);
        const cat = categories.find(c => c.id === r.category_id);
        return {
          id: r.id,
          user_id: r.user_id,
          email: r.user_id === currentUser?.id ? (currentUser?.email || '') : (profile?.display_name || ''),
          display_name: profile?.display_name || '',
          role: r.role as UserRole,
          category_id: r.category_id,
          category_name: cat?.name,
          unit_id: r.unit_id,
          unit_name: unit?.name,
        };
      });
      setMembers(membersList);

      // Get pending invites
      const { data: invites } = await supabase
        .from('team_members' as any)
        .select('*')
        .eq('team_id', teamId)
        .eq('status', 'pending') as any;

      const invitesList: TeamMemberWithRole[] = (invites || []).map((inv: any) => {
        const perms = inv.permissions || {};
        const cat = categories.find(c => c.id === perms.pending_category_id);
        const unit = units.find(u => u.id === perms.pending_unit_id);
        return {
          id: inv.id,
          user_id: '',
          email: inv.member_email,
          display_name: inv.member_email,
          role: (inv.role || 'admin') as UserRole,
          category_id: perms.pending_category_id || null,
          category_name: cat?.name,
          unit_id: perms.pending_unit_id || null,
          unit_name: unit?.name,
          invite_token: inv.invite_token,
          status: 'pending',
        };
      });
      setPendingInvites(invitesList);
    } catch (err) {
      console.error('Erro ao carregar membros:', err);
    } finally {
      setLoading(false);
    }
  }, [teamId, units, categories]);

  const fetchUnits = useCallback(async () => {
    if (!teamId) return;
    const { data } = await supabase
      .from('units')
      .select('id, name')
      .eq('team_id', teamId)
      .eq('active', true);
    setUnits(data || []);
  }, [teamId]);

  useEffect(() => { fetchUnits(); }, [fetchUnits]);
  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const openAdd = () => {
    setEditingMember(null);
    setInviteEmail('');
    setSelectedRole('admin');
    setSelectedCategoryId('');
    setSelectedUnitId('');
    setDialogOpen(true);
  };

  const openEdit = (member: TeamMemberWithRole) => {
    setEditingMember(member);
    setSelectedRole(member.role);
    setSelectedCategoryId(member.category_id || '');
    setSelectedUnitId(member.unit_id || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!teamId) return;

    // Validate required fields per role
    if (selectedRole === 'category_chief' && !selectedCategoryId) {
      toast.error('Selecione a categoria para o Chefe de Categoria.');
      return;
    }
    if (selectedRole === 'unit_manager' && !selectedUnitId) {
      toast.error('Selecione a unidade para o Gerente de Unidade.');
      return;
    }
    if (selectedRole === 'professional' && (!selectedCategoryId || !selectedUnitId)) {
      toast.error('Profissional deve ter categoria e unidade definidas.');
      return;
    }

    try {
      if (editingMember && !editingMember.status) {
        // Update existing user_role
        const roleData: any = {
          role: selectedRole,
          category_id: ['category_chief', 'professional'].includes(selectedRole) ? selectedCategoryId || null : null,
          unit_id: ['unit_manager', 'professional'].includes(selectedRole) ? selectedUnitId || null : null,
        };
        const { error } = await supabase
          .from('user_roles')
          .update(roleData)
          .eq('id', editingMember.id);
        if (error) throw error;
        toast.success('Papel atualizado com sucesso!');
      } else {
        // Create new invite
        if (!inviteEmail.trim()) {
          toast.error('Informe o e-mail do usuário.');
          return;
        }

        const inviteToken = generateId();
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) throw new Error('Não autenticado');

        const { error: tmError } = await supabase
          .from('team_members' as any)
          .insert({
            owner_id: currentUser.id,
            member_email: inviteEmail.trim().toLowerCase(),
            team_id: teamId,
            role: selectedRole,
            invite_token: inviteToken,
            permissions: {
              pending_category_id: ['category_chief', 'professional'].includes(selectedRole) ? selectedCategoryId : null,
              pending_unit_id: ['unit_manager', 'professional'].includes(selectedRole) ? selectedUnitId : null,
            },
            status: 'pending',
          } as any) as any;

        if (tmError) throw tmError;

        const link = `${window.location.origin}/convite/${inviteToken}`;
        setGeneratedLink(link);
        setDialogOpen(false);
        setLinkDialogOpen(true);
      }

      setDialogOpen(false);
      fetchMembers();
    } catch (err: any) {
      console.error('Erro ao salvar:', err);
      toast.error(err.message || 'Erro ao salvar alterações.');
    }
  };

  const handleRemove = async (member: TeamMemberWithRole) => {
    if (!confirm(`Remover ${member.display_name || member.email} da equipe?`)) return;
    try {
      if (member.status === 'pending') {
        await supabase.from('team_members' as any).delete().eq('id', member.id) as any;
      } else {
        const { error } = await supabase.from('user_roles').delete().eq('id', member.id);
        if (error) throw error;
      }
      toast.success('Membro removido.');
      fetchMembers();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover membro.');
    }
  };

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/convite/${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim()) { toast.error('Informe o nome da categoria.'); return; }
    if (!teamId) return;
    try {
      await supabase.from('categories' as any).insert({
        team_id: teamId, name: newCatName.trim(), color: newCatColor,
      } as any) as any;
      toast.success('Categoria criada!');
      setNewCatName('');
      setCatDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar categoria.');
    }
  };

  const COLOR_PRESETS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#3B82F6', '#F97316'];

  if (loading) return <div className="p-8 text-muted-foreground flex items-center gap-2"><Clock className="w-4 h-4 animate-spin" /> Carregando...</div>;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Gerenciar Equipe"
        description="Adicione membros, categorias e defina seus níveis de acesso"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCatDialogOpen(true)} className="gap-2">
              <Tag className="w-4 h-4" />
              Nova Categoria
            </Button>
            <Button onClick={openAdd} className="gap-2">
              <UserPlus className="w-4 h-4" />
              Convidar Membro
            </Button>
          </div>
        }
      />

      {/* Categories Section */}
      {categories.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-muted-foreground mb-2 flex items-center gap-2"><Tag className="w-3.5 h-3.5" /> Categorias</h3>
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <Badge key={cat.id} variant="outline" className="text-xs px-3 py-1.5 gap-1.5" style={{ borderColor: cat.color, color: cat.color }}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                {cat.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Role Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ROLE_OPTIONS.map(opt => {
          const count = members.filter(m => m.role === opt.value).length;
          return (
            <div key={opt.value} className="stat-card">
              <div className="flex items-center gap-2">
                <div className={cn('p-1.5 rounded-lg', ROLE_COLORS[opt.value])}>
                  <opt.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-lg font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{opt.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-muted-foreground mb-2">Convites Pendentes</h3>
          <div className="grid gap-2 max-w-3xl">
            {pendingInvites.map(inv => (
              <Card key={inv.id} className="group hover:border-warning/30 transition-all border-dashed">
                <CardHeader className="pb-2 px-5 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-warning/10 text-warning">
                        <Mail className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold">{inv.email}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/20">Pendente</Badge>
                          <Badge variant="outline" className={cn('text-[10px]', ROLE_COLORS[inv.role])}>{ROLE_LABELS[inv.role]}</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {inv.invite_token && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyLink(inv.invite_token!)} title="Copiar link">
                          <Copy className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleRemove(inv)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Active Members */}
      {members.length === 0 && pendingInvites.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum membro na equipe"
          description="Adicione membros para gerenciar o acesso ao sistema"
        />
      ) : members.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-muted-foreground mb-2">Membros Ativos</h3>
          <div className="grid gap-3 max-w-3xl">
            {members.map(member => (
              <Card key={member.id} className="group hover:border-primary/30 transition-all">
                <CardHeader className="pb-2 px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', ROLE_COLORS[member.role])}>
                        <Shield className="w-5 h-5" />
                      </div>
                      <div>
                        <CardTitle className="text-sm font-bold">
                          {member.display_name || member.email || 'Usuário'}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={cn('text-[10px]', ROLE_COLORS[member.role])}>
                            {ROLE_LABELS[member.role]}
                          </Badge>
                          {(member.role === 'category_chief' || member.role === 'professional') && member.category_name && (
                            <Badge variant="secondary" className="text-[10px]">{member.category_name}</Badge>
                          )}
                          {(member.role === 'unit_manager' || member.role === 'professional') && member.unit_name && (
                            <Badge variant="secondary" className="text-[10px]">{member.unit_name}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(member)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleRemove(member)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              {editingMember ? 'Editar Papel' : 'Convidar Membro'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {!editingMember && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">E-mail do usuário</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="usuario@email.com"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nível de Acesso</Label>
              <div className="grid gap-2">
                {ROLE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setSelectedRole(opt.value)}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-xl border transition-all text-left",
                      selectedRole === opt.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                        : "border-border hover:border-border/80 hover:bg-muted/30"
                    )}
                  >
                    <div className={cn('p-1.5 rounded-lg mt-0.5', ROLE_COLORS[opt.value])}>
                      <opt.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{opt.label}</p>
                      <p className="text-[11px] text-muted-foreground">{opt.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {(selectedRole === 'category_chief' || selectedRole === 'professional') && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Categoria</Label>
                {categories.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">Nenhuma categoria cadastrada. Crie uma primeiro.</p>
                ) : (
                  <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                    <SelectTrigger><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                    <SelectContent>
                      {categories.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                            {c.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {(selectedRole === 'unit_manager' || selectedRole === 'professional') && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Unidade</Label>
                <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                  <SelectContent>
                    {units.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {units.length === 0 && (
                  <p className="text-[10px] text-muted-foreground">Nenhuma unidade cadastrada.</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>
                {editingMember ? 'Salvar' : 'Gerar Link de Convite'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="bg-card max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link className="w-5 h-5 text-primary" />
              Link de Convite Gerado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Envie este link para o usuário. Ele será automaticamente associado à equipe ao criar a conta ou fazer login.
            </p>
            <div className="flex gap-2">
              <Input value={generatedLink} readOnly className="text-xs" />
              <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(generatedLink); toast.success('Link copiado!'); }}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <Button className="w-full" onClick={() => setLinkDialogOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="bg-card max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-primary" />
              Nova Categoria
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nome da Categoria</Label>
              <Input
                placeholder="Ex: Enfermeiro, Técnico, Fisioterapeuta..."
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {COLOR_PRESETS.map(color => (
                  <button
                    key={color}
                    onClick={() => setNewCatColor(color)}
                    className={cn(
                      'w-8 h-8 rounded-lg transition-all',
                      newCatColor === color ? 'ring-2 ring-offset-2 ring-primary' : ''
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setCatDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleAddCategory}>Criar Categoria</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
