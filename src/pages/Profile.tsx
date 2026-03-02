import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  User, Users, Copy, Check, Plus, Clock, KeyRound, UserPlus,
  Activity, RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const ACTION_LABELS: Record<string, string> = {
  leave_request_created: '📋 Registrou pedido de folga',
  leave_request_deleted: '🗑️ Removeu pedido de folga',
  schedule_published: '📤 Publicou escala no portal',
};

export default function ProfilePage() {
  const {
    profile, teamProfiles, invites, activityLog, loading,
    updateProfile, generateInviteCode, joinTeamByCode, refreshProfile,
  } = useProfile();

  const [editName, setEditName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleSaveName = () => {
    if (editName.trim()) {
      updateProfile({ display_name: editName.trim() });
      setEditingName(false);
    }
  };

  const handleGenerateCode = async () => {
    setGeneratingCode(true);
    await generateInviteCode();
    setGeneratingCode(false);
  };

  const handleJoinTeam = async () => {
    if (!joinCode.trim()) return;
    const success = await joinTeamByCode(joinCode);
    if (success) {
      setJoinDialogOpen(false);
      setJoinCode('');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      toast.success('Código copiado!');
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Perfil & Equipe"
        description="Gerencie seu perfil, convide membros e veja o histórico de ações"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl">

        {/* ── Meu Perfil ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="w-5 h-5 text-primary" />
              Meu Perfil
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Nome de exibição</Label>
              {editingName ? (
                <div className="flex gap-2 mt-1">
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Seu nome"
                    onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                    autoFocus
                  />
                  <Button size="sm" onClick={handleSaveName}>Salvar</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>Cancelar</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-medium text-lg">{profile?.display_name || 'Sem nome'}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => {
                      setEditName(profile?.display_name || '');
                      setEditingName(true);
                    }}
                  >
                    Editar
                  </Button>
                </div>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Membro desde {profile?.created_at && format(new Date(profile.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </div>
          </CardContent>
        </Card>

        {/* ── Equipe ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="w-5 h-5 text-primary" />
              Minha Equipe
            </CardTitle>
            <CardDescription>
              {teamProfiles.length} {teamProfiles.length === 1 ? 'membro' : 'membros'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {teamProfiles.map(member => (
              <div
                key={member.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border',
                  member.user_id === profile?.user_id
                    ? 'bg-primary/5 border-primary/20'
                    : 'bg-muted/30 border-border'
                )}
              >
                <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-sm">
                  {(member.display_name || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{member.display_name || 'Sem nome'}</div>
                  <div className="text-xs text-muted-foreground">
                    {member.user_id === profile?.user_id && '(Você)'}
                  </div>
                </div>
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    Entrar com Código
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle>Entrar em uma Equipe</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Código de Convite</Label>
                      <Input
                        value={joinCode}
                        onChange={e => setJoinCode(e.target.value.toUpperCase())}
                        placeholder="Ex: CONV-AB3D4F"
                        className="font-mono"
                      />
                    </div>
                    <Button onClick={handleJoinTeam} className="w-full" disabled={!joinCode.trim()}>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Entrar na Equipe
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>

        {/* ── Códigos de Convite ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Plus className="w-5 h-5 text-primary" />
                Códigos de Convite
              </CardTitle>
              <Button size="sm" onClick={handleGenerateCode} disabled={generatingCode} className="gap-1.5">
                {generatingCode ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Gerar Código
              </Button>
            </div>
            <CardDescription>
              Gere códigos para convidar novos admins. Cada código expira em 7 dias.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invites.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum código gerado ainda.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {invites.map(invite => {
                  const expired = new Date(invite.expires_at) < new Date();
                  const used = !!invite.used_by;

                  return (
                    <div
                      key={invite.id}
                      className={cn(
                        'flex items-center justify-between p-3 rounded-lg border text-sm',
                        used ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800' :
                        expired ? 'bg-muted/50 border-border opacity-60' :
                        'bg-card border-border'
                      )}
                    >
                      <div>
                        <span className="font-mono font-bold tracking-wider">{invite.code}</span>
                        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {used ? 'Utilizado' : expired ? 'Expirado' : `Expira em ${format(new Date(invite.expires_at), 'dd/MM/yyyy')}`}
                        </div>
                      </div>
                      {!used && !expired && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => copyCode(invite.code)}
                        >
                          {copiedCode === invite.code ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Log de Atividades ── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="w-5 h-5 text-primary" />
                Histórico de Ações
              </CardTitle>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={refreshProfile}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {activityLog.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma ação registrada ainda.
              </p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {activityLog.map(log => (
                  <div key={log.id} className="flex gap-3 p-3 rounded-lg bg-muted/30 border border-border text-sm">
                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                      {(log.profile?.display_name || '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs">{log.profile?.display_name || 'Desconhecido'}</div>
                      <div className="text-sm">
                        {ACTION_LABELS[log.action] || log.action}
                      </div>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {(log.details as any).professionalName && `Profissional: ${(log.details as any).professionalName}`}
                          {(log.details as any).leaveType && ` • ${(log.details as any).leaveType}`}
                        </div>
                      )}
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
