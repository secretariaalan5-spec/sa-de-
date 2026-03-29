import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAppData } from '@/hooks/useAppData';
import { Users, Plus, Pencil, Trash2, Mail, Shield, Clock, UserPlus, Building2, Stethoscope } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/hooks/useTeamPermissions';
import { cn } from '@/lib/utils';

interface TeamMemberWithRole {
  id: string;
  user_id: string;
  email: string;
  display_name: string;
  role: UserRole;
  category: string | null;
  unit_id: string | null;
  unit_name?: string;
}

const ROLE_OPTIONS: { value: UserRole; label: string; description: string; icon: typeof Shield }[] = [
  { value: 'admin', label: 'Administrador', description: 'Acesso total ao sistema', icon: Shield },
  { value: 'rh', label: 'RH', description: 'Leitura total, sem edição', icon: Users },
  { value: 'category_chief', label: 'Chefe de Categoria', description: 'Gerencia profissionais e escalas da sua categoria', icon: Stethoscope },
  { value: 'unit_manager', label: 'Gerente de Unidade', description: 'Visualiza e cadastra profissionais da sua unidade', icon: Building2 },
];

const ROLE_COLORS: Record<UserRole, string> = {
  admin: 'bg-primary/10 text-primary border-primary/20',
  rh: 'bg-blue-500/10 text-blue-600 border-blue-200',
  category_chief: 'bg-amber-500/10 text-amber-600 border-amber-200',
  unit_manager: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  rh: 'RH',
  category_chief: 'Chefe de Categoria',
  unit_manager: 'Gerente de Unidade',
};

const CATEGORY_OPTIONS = [
  { value: 'nurse', label: 'Enfermeiro' },
  { value: 'tech', label: 'Técnico' },
];

export default function TeamManagement() {
  const { teamId } = useAppData();
  const [members, setMembers] = useState<TeamMemberWithRole[]>([]);
  const [units, setUnits] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMemberWithRole | null>(null);

  // Form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('admin');
  const [selectedCategory, setSelectedCategory] = useState('nurse');
  const [selectedUnitId, setSelectedUnitId] = useState('');

  const fetchMembers = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      // Get all user_roles for this team
      const { data: roles, error } = await supabase
        .from('user_roles')
        .select('id, user_id, role, category, unit_id')
        .eq('team_id', teamId);

      if (error) throw error;

      // Get profiles for these users
      const userIds = (roles || []).map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      // Get auth emails via current user context
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      const membersList: TeamMemberWithRole[] = (roles || []).map(r => {
        const profile = profiles?.find(p => p.user_id === r.user_id);
        const unit = units.find(u => u.id === r.unit_id);
        return {
          id: r.id,
          user_id: r.user_id,
          email: r.user_id === currentUser?.id ? (currentUser?.email || '') : (profile?.display_name || ''),
          display_name: profile?.display_name || '',
          role: r.role as UserRole,
          category: r.category,
          unit_id: r.unit_id,
          unit_name: unit?.name,
        };
      });

      setMembers(membersList);
    } catch (err) {
      console.error('Erro ao carregar membros:', err);
    } finally {
      setLoading(false);
    }
  }, [teamId, units]);

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
    setSelectedCategory('nurse');
    setSelectedUnitId('');
    setDialogOpen(true);
  };

  const openEdit = (member: TeamMemberWithRole) => {
    setEditingMember(member);
    setSelectedRole(member.role);
    setSelectedCategory(member.category || 'nurse');
    setSelectedUnitId(member.unit_id || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!teamId) return;

    const roleData: any = {
      role: selectedRole,
      team_id: teamId,
      category: selectedRole === 'category_chief' ? selectedCategory : null,
      unit_id: selectedRole === 'unit_manager' ? selectedUnitId : null,
    };

    try {
      if (editingMember) {
        // Update existing role
        const { error } = await supabase
          .from('user_roles')
          .update(roleData)
          .eq('id', editingMember.id);
        if (error) throw error;
        toast.success('Papel atualizado com sucesso!');
      } else {
        // Invite new member: find user by email via team_invites flow
        // For now, create via team_members + user_roles
        if (!inviteEmail.trim()) {
          toast.error('Informe o e-mail do usuário.');
          return;
        }

        // Check if user exists in profiles
        const { data: existingProfile } = await supabase
          .from('profiles')
          .select('user_id')
          .ilike('display_name', inviteEmail.trim())
          .maybeSingle();

        // Try to find by checking auth (we can't query auth.users directly)
        // Instead, create a team_invite and set user_roles when they join
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) throw new Error('Não autenticado');

        // Create team_member invite
        const { error: tmError } = await supabase
          .from('team_members')
          .insert({
            owner_id: currentUser.id,
            member_email: inviteEmail.trim().toLowerCase(),
            team_id: teamId,
            role: selectedRole,
            permissions: {
              pending_role: selectedRole,
              pending_category: selectedRole === 'category_chief' ? selectedCategory : null,
              pending_unit_id: selectedRole === 'unit_manager' ? selectedUnitId : null,
            },
            status: 'pending',
          });

        if (tmError) throw tmError;
        toast.success(`Convite enviado para ${inviteEmail}. O usuário receberá acesso ao fazer login.`);
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
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', member.id);
      if (error) throw error;
      toast.success('Membro removido.');
      fetchMembers();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover membro.');
    }
  };

  if (loading) return <div className="p-8 text-muted-foreground flex items-center gap-2"><Clock className="w-4 h-4 animate-spin" /> Carregando...</div>;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Gerenciar Equipe"
        description="Adicione membros e defina seus níveis de acesso"
        action={
          <Button onClick={openAdd} className="gap-2">
            <UserPlus className="w-4 h-4" />
            Adicionar Membro
          </Button>
        }
      />

      {/* Role Legend */}
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

      {/* Members List */}
      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum membro na equipe"
          description="Adicione membros para gerenciar o acesso ao sistema"
        />
      ) : (
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
                        {member.role === 'category_chief' && member.category && (
                          <Badge variant="secondary" className="text-[10px]">
                            {member.category === 'nurse' ? 'Enfermeiros' : 'Técnicos'}
                          </Badge>
                        )}
                        {member.role === 'unit_manager' && member.unit_name && (
                          <Badge variant="secondary" className="text-[10px]">
                            {member.unit_name}
                          </Badge>
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
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              {editingMember ? 'Editar Papel' : 'Adicionar Membro'}
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

            {selectedRole === 'category_chief' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Categoria</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedRole === 'unit_manager' && (
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
                  <p className="text-[10px] text-muted-foreground">Nenhuma unidade cadastrada. Crie uma unidade primeiro.</p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>
                {editingMember ? 'Salvar' : 'Convidar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
