import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTeamMembers, TeamMember, PendingManagerRequest } from '@/hooks/useTeamMembers';
import { useAppData } from '@/hooks/useAppData';
import { Users, Plus, Pencil, Trash2, Mail, Shield, Clock, Link2, Copy, Check, CheckCircle2, XCircle } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  const { teamId } = useAppData();
  const {
    members,
    pendingRequests,
    loading,
    updateMemberPermissions,
    removeMember,
    approveManagerRequest,
    rejectManagerRequest
  } = useTeamMembers();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<PendingManagerRequest | null>(null);
  const [perms, setPerms] = useState<Record<string, boolean>>({ ...DEFAULT_PERMISSIONS });
  const [role, setRole] = useState<string>('member');
  const [copied, setCopied] = useState(false);

  const inviteLink = teamId
    ? `${window.location.origin}/portal?team=${teamId}`
    : '';

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const openApprove = (req: PendingManagerRequest) => {
    setSelectedRequest(req);
    setPerms({ ...DEFAULT_PERMISSIONS });
    setRole('member');
    setApprovalDialogOpen(true);
  };

  const openEdit = (member: TeamMember) => {
    setEditingMember(member);
    setPerms({ ...DEFAULT_PERMISSIONS, ...member.permissions });
    setRole(member.role || 'member');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (editingMember) {
      await updateMemberPermissions(editingMember.id, perms, role);
    }
    setDialogOpen(false);
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    const ok = await approveManagerRequest(selectedRequest.id, perms, role);
    if (ok) setApprovalDialogOpen(false);
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

  if (loading) return <div className="p-8 text-muted-foreground flex items-center gap-2"><Clock className="w-4 h-4 animate-spin" /> Carregando...</div>;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Equipe"
        description="Gerencie os administradores que podem editar escalas e folgas"
      />

      {/* Link de Convite Especial */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold flex items-center gap-2 text-primary">
              <Link2 className="w-4 h-4" /> Link de Convite Especial
            </h3>
            <p className="text-xs text-muted-foreground">
              Envie este link para que novos gestores peçam para entrar na sua equipe via Portal
            </p>
            <div className="mt-2 font-mono text-[10px] bg-background/50 p-2 rounded border border-primary/10 break-all select-all">
              {inviteLink}
            </div>
          </div>
          <Button onClick={copyLink} className="shrink-0 gap-2" variant="default" size="sm">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            Copiar Link
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="members" className="gap-2">
            <Users className="w-4 h-4" /> Membros ({members.length})
          </TabsTrigger>
          <TabsTrigger value="requests" className="gap-2 relative">
            <Shield className="w-4 h-4" /> Solicitações
            {pendingRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-[10px] text-white rounded-full flex items-center justify-center font-bold">
                {pendingRequests.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          {members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nenhum membro adicionado"
              description="Use o link acima para que novos gestores peçam acesso à equipe"
            />
          ) : (
            <div className="grid gap-4 max-w-3xl">
              {members.map(member => (
                <Card key={member.id} className="bg-card group hover:border-primary/30 transition-all">
                  <CardHeader className="pb-3 px-5 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Mail className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-bold flex items-center gap-2">
                            {member.member_email}
                            <Badge variant="outline" className={member.role === 'admin' ? "text-violet-600 border-violet-200 bg-violet-50" : "text-slate-600 border-slate-200 bg-slate-50"}>
                              {member.role === 'admin' ? 'Admin' : 'Gestor'}
                            </Badge>
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {getActivePermsCount(member.permissions || {})} / {Object.keys(PERMISSION_LABELS).length} permissões ativas
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(member.status)}
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(member)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleRemove(member)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 px-5 pb-4">
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(PERMISSION_LABELS).map(([key, { label }]) => (
                        <Badge
                          key={key}
                          variant="outline"
                          className={member.permissions?.[key]
                            ? 'bg-primary/5 text-primary border-primary/20 text-[10px] h-5'
                            : 'text-muted-foreground/40 text-[10px] h-5 opacity-40 border-muted'
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
        </TabsContent>

        <TabsContent value="requests">
          {pendingRequests.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-dashed">
              <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma solicitação de acesso pendente</p>
              <p className="text-xs mt-1">Gestores que usarem o link especial aparecerão aqui</p>
            </div>
          ) : (
            <div className="grid gap-4 max-w-3xl">
              {pendingRequests.map(req => (
                <Card key={req.id} className="bg-card border-amber-500/20">
                  <CardHeader className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                          <Users className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                          <CardTitle className="text-base font-bold">{req.full_name}</CardTitle>
                          <CardDescription>{req.email}</CardDescription>
                          <Badge variant="outline" className="mt-1.5 text-amber-700 bg-amber-50 border-amber-200">
                            Pendente Aprovação
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => openApprove(req)} className="gap-2">
                          <CheckCircle2 className="w-4 h-4" /> Aprovar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => rejectManagerRequest(req.id)} className="text-destructive hover:bg-destructive/5">
                          <XCircle className="w-4 h-4" /> Rejeitar
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog de convite / edição por email */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Editar Permissões
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
              <p className="text-xs text-muted-foreground">Membro:</p>
              <p className="font-bold">{editingMember?.member_email}</p>
            </div>

            <div className="space-y-3">
              <Label className="text-xs uppercase font-bold text-primary">Nível de Acesso</Label>
              <RadioGroup value={role} onValueChange={setRole} className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="member" id="r-member-edit" />
                  <Label htmlFor="r-member-edit" className="font-medium">Gestor</Label>
                </div>
                <div className="flex items-center space-x-2 text-violet-600">
                  <RadioGroupItem value="admin" id="r-admin-edit" />
                  <Label htmlFor="r-admin-edit" className="font-bold">Administrador</Label>
                </div>
              </RadioGroup>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3 border-b pb-2">
                <Label className="text-xs uppercase font-bold text-primary">Permissões de acesso</Label>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={selectAll}>Tudo</Button>
                  <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={selectNone}>Nenhum</Button>
                </div>
              </div>

              <div className="space-y-2">
                {Object.entries(PERMISSION_LABELS).map(([key, { label, description }]) => (
                  <div key={key} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                    <Switch
                      checked={perms[key] || false}
                      onCheckedChange={() => togglePerm(key)}
                      className="mt-1 scale-90"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold leading-tight">{label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>
                {editingMember ? 'Salvar Alterações' : 'Enviar Convite'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de aprovação de solicitação por link */}
      <Dialog open={approvalDialogOpen} onOpenChange={setApprovalDialogOpen}>
        <DialogContent className="bg-card max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Aprovar Gestor
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
              <p className="text-xs text-muted-foreground">Profissional:</p>
              <p className="font-bold">{selectedRequest?.full_name}</p>
              <p className="text-xs">{selectedRequest?.email}</p>
            </div>

            <div className="space-y-3">
              <Label className="text-xs uppercase font-bold text-emerald-600">Nível de Acesso</Label>
              <RadioGroup value={role} onValueChange={setRole} className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="member" id="r-member" />
                  <Label htmlFor="r-member" className="font-medium">Gestor</Label>
                </div>
                <div className="flex items-center space-x-2 text-violet-600">
                  <RadioGroupItem value="admin" id="r-admin" />
                  <Label htmlFor="r-admin" className="font-bold">Administrador</Label>
                </div>
              </RadioGroup>
              <p className="text-[10px] text-muted-foreground italic">Administradores têm acesso total por padrão, mas você pode definir permissões específicas abaixo.</p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3 border-b pb-2">
                <Label className="text-xs uppercase font-bold text-emerald-600">Definir Permissões</Label>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={selectAll}>Tudo</Button>
                  <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={selectNone}>Nenhum</Button>
                </div>
              </div>

              <div className="space-y-2">
                {Object.entries(PERMISSION_LABELS).map(([key, { label, description }]) => (
                  <div key={key} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                    <Switch
                      checked={perms[key] || false}
                      onCheckedChange={() => togglePerm(key)}
                      className="mt-1 scale-90"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold leading-tight">{label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setApprovalDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleApprove} className="bg-emerald-600 hover:bg-emerald-700">
                Confirmar Acesso
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
