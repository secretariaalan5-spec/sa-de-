import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTeamMembers, TeamMember } from '@/hooks/useTeamMembers';
import { Users, Plus, Pencil, Trash2, Mail, Shield, Clock } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { toast } from 'sonner';

const PERMISSION_LABELS: Record<string, { label: string; description: string }> = {
  escalas_servicos: { label: 'Escalas de Serviços', description: 'Visualizar e editar escalas de enfermeiros e técnicos' },
  escalas_emult: { label: 'Escalas eMult', description: 'Visualizar e editar escalas da equipe eMult' },
  profissionais: { label: 'Profissionais', description: 'Gerenciar cadastro de profissionais' },
  unidades: { label: 'Unidades', description: 'Gerenciar unidades de saúde' },
  folgas: { label: 'Pedidos de Folga', description: 'Aprovar ou rejeitar pedidos de folga' },
  relatorios: { label: 'Relatórios', description: 'Visualizar relatórios e estatísticas' },
  publicar: { label: 'Publicar no Portal', description: 'Publicar escalas no portal público' },
  configuracoes: { label: 'Configurações', description: 'Acessar backup e configurações do sistema' },
  gerenciar_membros: { label: 'Gerenciar Membros', description: 'Convidar e gerenciar membros da equipe' },
};

const DEFAULT_PERMISSIONS: Record<string, boolean> = {
  escalas_servicos: true,
  escalas_emult: true,
  profissionais: true,
  unidades: true,
  folgas: true,
  relatorios: true,
  publicar: false,
  configuracoes: false,
  gerenciar_membros: false,
};

export default function TeamManagement() {
  const { members, loading, inviteMember, updateMemberPermissions, removeMember } = useTeamMembers();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [email, setEmail] = useState('');
  const [perms, setPerms] = useState<Record<string, boolean>>({ ...DEFAULT_PERMISSIONS });

  const openInvite = () => {
    setEditingMember(null);
    setEmail('');
    setPerms({ ...DEFAULT_PERMISSIONS });
    setDialogOpen(true);
  };

  const openEdit = (member: TeamMember) => {
    setEditingMember(member);
    setEmail(member.member_email);
    setPerms({ ...DEFAULT_PERMISSIONS, ...member.permissions });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (editingMember) {
      await updateMemberPermissions(editingMember.id, perms);
    } else {
      if (!email.trim() || !email.includes('@')) {
        toast.error('Digite um e-mail válido');
        return;
      }
      await inviteMember(email, perms);
    }
    setDialogOpen(false);
  };

  const handleRemove = async (member: TeamMember) => {
    if (confirm(`Remover ${member.member_email} da equipe?`)) {
      await removeMember(member.id);
    }
  };

  const togglePerm = (key: string) => {
    setPerms(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAll = () => {
    const allTrue: Record<string, boolean> = {};
    Object.keys(PERMISSION_LABELS).forEach(k => { allTrue[k] = true; });
    setPerms(allTrue);
  };

  const selectNone = () => {
    const allFalse: Record<string, boolean> = {};
    Object.keys(PERMISSION_LABELS).forEach(k => { allFalse[k] = false; });
    setPerms(allFalse);
  };

  const getStatusBadge = (status: string | null) => {
    if (status === 'accepted') return <Badge variant="default" className="bg-emerald-500/15 text-emerald-600 border-emerald-200">Ativo</Badge>;
    return <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 border-amber-200"><Clock className="w-3 h-3 mr-1" />Pendente</Badge>;
  };

  const getActivePermsCount = (permissions: Record<string, boolean>) => {
    return Object.values(permissions).filter(Boolean).length;
  };

  if (loading) return <div className="p-8 text-muted-foreground">Carregando...</div>;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Gerenciar Equipe"
        description="Convide pessoas para gerenciar as escalas e defina o nível de acesso de cada uma"
        action={
          <Button onClick={openInvite}>
            <Plus className="w-4 h-4 mr-2" />
            Convidar Membro
          </Button>
        }
      />

      {members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum membro adicionado"
          description="Convide pessoas para ajudar a gerenciar as escalas da equipe"
          actionLabel="Convidar Membro"
          onAction={openInvite}
        />
      ) : (
        <div className="grid gap-4 max-w-3xl">
          {members.map(member => (
            <Card key={member.id} className="bg-card">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{member.member_email}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {getActivePermsCount(member.permissions || {})}/{Object.keys(PERMISSION_LABELS).length} permissões
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(member.status)}
                    <Button variant="ghost" size="icon" onClick={() => openEdit(member)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleRemove(member)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(PERMISSION_LABELS).map(([key, { label }]) => (
                    <Badge
                      key={key}
                      variant={member.permissions?.[key] ? 'default' : 'outline'}
                      className={member.permissions?.[key]
                        ? 'bg-primary/10 text-primary border-primary/20 text-xs'
                        : 'text-muted-foreground text-xs opacity-50'
                      }
                    >
                      {label}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de convite / edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              {editingMember ? 'Editar Permissões' : 'Convidar Membro'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            {!editingMember && (
              <div>
                <Label>E-mail do membro *</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  A pessoa receberá acesso ao painel ao fazer login com este e-mail
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm font-semibold">Permissões de acesso</Label>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectAll}>Tudo</Button>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={selectNone}>Nenhum</Button>
                </div>
              </div>

              <div className="space-y-3">
                {Object.entries(PERMISSION_LABELS).map(([key, { label, description }]) => (
                  <div key={key} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/40 transition-colors">
                    <Switch
                      checked={perms[key] || false}
                      onCheckedChange={() => togglePerm(key)}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>
                {editingMember ? 'Salvar' : 'Enviar Convite'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
