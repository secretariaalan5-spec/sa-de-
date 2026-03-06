import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAppData } from '@/hooks/useAppData';
import { useProfile } from '@/hooks/useProfile';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Copy, Check, Globe, RefreshCw, Link2, Users, Stethoscope, Syringe, Clock, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { LEAVE_TYPE_LABELS, LeaveType } from '@/types/serviceSchedule';

interface ProfessionalUserRecord {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  professional_id: string | null;
  team_id: string | null;
  category: string;
  status: string;
  created_at: string;
}

export default function Registration() {
  const { teamId } = useAppData();
  const { profile, logActivity } = useProfile();
  const { professionals, addProfessional, deleteProfessional } = useServiceProfessionals();
  const { addRequest } = useLeaveRequests();
  const [copied, setCopied] = useState(false);
  const [pendingUsers, setPendingUsers] = useState<ProfessionalUserRecord[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<ProfessionalUserRecord[]>([]);
  const [loadingApprovals, setLoadingApprovals] = useState(true);

  const portalLink = teamId
    ? `${window.location.origin}/portal?team=${teamId}`
    : '';

  const copyToClipboard = () => {
    if (!portalLink) {
      toast.error('Aguarde o carregamento da equipe.');
      return;
    }
    navigator.clipboard.writeText(portalLink).then(() => {
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = portalLink;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      toast.success('Link copiado!');
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const shareOnWhatsApp = () => {
    const text =
      `*Portal do Profissional - Secretaria de Saúde*\n\n` +
      `Olá! Acesse o portal para ver suas escalas, créditos e solicitar folgas.\n\n` +
      `🔗 *Link de Acesso:* ${portalLink}\n\n` +
      `📋 Clique no link, entre com sua conta Google, escolha sua categoria profissional e aguarde aprovação.\n\n` +
      `_Após o cadastro, o administrador aprovará seu acesso._`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const fetchApprovals = useCallback(async () => {
    if (!profile?.team_id) return;
    setLoadingApprovals(true);

    const { data: users } = await (supabase
      .from('professional_users' as any)
      .select('*')
      .eq('team_id', profile.team_id)
      .order('created_at', { ascending: false }) as any);

    const allUsers = (users || []) as ProfessionalUserRecord[];
    setPendingUsers(allUsers.filter(u => u.status === 'pending'));
    setApprovedUsers(allUsers.filter(u => u.status === 'approved'));
    setLoadingApprovals(false);
  }, [profile?.team_id]);

  useEffect(() => { fetchApprovals(); }, [fetchApprovals]);

  const handleApprove = async (user: ProfessionalUserRecord) => {
    const newProf = addProfessional({
      name: user.full_name,
      category: user.category as 'nurse' | 'tech',
      monthlyHours: 200,
      active: true,
    });

    const { error } = await (supabase
      .from('professional_users' as any)
      .update({ status: 'approved', professional_id: newProf.id } as any)
      .eq('id', user.id) as any);

    if (error) {
      toast.error('Erro ao aprovar');
      return;
    }

    toast.success(`${user.full_name} aprovado(a) e cadastrado(a) automaticamente!`);
    logActivity('professional_approved', { name: user.full_name, email: user.email });
    fetchApprovals();
  };

  const handleReject = async (user: ProfessionalUserRecord) => {
    const { error } = await (supabase
      .from('professional_users' as any)
      .update({ status: 'rejected' } as any)
      .eq('id', user.id) as any);

    if (error) {
      toast.error('Erro ao rejeitar');
      return;
    }

    toast.success(`${user.full_name} rejeitado(a).`);
    fetchApprovals();
  };

  const handleRemoveApproved = async (user: ProfessionalUserRecord) => {
    if (!confirm(`Remover ${user.full_name}? O profissional será desvinculado.`)) return;

    if (user.professional_id) {
      deleteProfessional(user.professional_id);
    }

    const { error } = await (supabase
      .from('professional_users' as any)
      .delete()
      .eq('id', user.id) as any);

    if (error) {
      toast.error('Erro ao remover');
      return;
    }

    toast.success(`${user.full_name} removido(a).`);
    fetchApprovals();
  };

  const categoryLabel = (cat: string) => cat === 'nurse' ? 'Enfermeiro(a)' : cat === 'tech' ? 'Técnico(a)' : 'eMult';
  const categoryIcon = (cat: string) => cat === 'nurse' ? <Stethoscope className="w-4 h-4" /> : cat === 'tech' ? <Syringe className="w-4 h-4" /> : <Users className="w-4 h-4" />;

  if (!teamId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground animate-pulse">
        <RefreshCw className="w-8 h-8 animate-spin mb-4 opacity-20" />
        <p className="text-sm font-medium">Sincronizando perfil administrativo...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Cadastro & Portal"
        description="Compartilhe o link do portal, acompanhe solicitações de acesso e gerencie sua equipe"
      />

      {/* Link do portal */}
      <div className="space-y-5 max-w-2xl">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 shrink-0 mt-0.5">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-sm mb-1">Como funciona</h3>
                <p className="text-sm text-muted-foreground">
                  Compartilhe o link abaixo com seus profissionais (Enfermeiros, Técnicos ou eMult).
                  Eles fazem login com Google, escolhem sua categoria e enviam a solicitação de acesso.
                  Você aprova e gerencia tudo nesta mesma tela.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              <h3 className="font-bold">Link do Portal</h3>
            </div>

            <div className="font-mono text-xs bg-muted/50 rounded-xl px-4 py-3 break-all text-muted-foreground border">
              {portalLink}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={copyToClipboard}
                variant="outline"
                className="flex-1 gap-2"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copiado!' : 'Copiar Link'}
              </Button>
              <Button
                onClick={shareOnWhatsApp}
                className="flex-1 gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white border-0"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
                WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aprovações de acesso e equipe */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Aprovações do Portal</h2>
          {loadingApprovals && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> Atualizando...
            </span>
          )}
        </div>

        <Tabs defaultValue="access" className="space-y-6">
          <TabsList className="grid grid-cols-2 md:grid-cols-3 max-w-lg">
            <TabsTrigger value="access" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Pendentes ({pendingUsers.length})
            </TabsTrigger>
            <TabsTrigger value="approved" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Equipe ({approvedUsers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="access" className="space-y-4">
            {pendingUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
                Nenhuma solicitação pendente.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingUsers.map(user => (
                  <Card key={user.id}>
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-foreground">{user.full_name}</h3>
                          <p className="text-sm text-muted-foreground">{user.email}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {categoryIcon(user.category)}
                            <span className="text-xs text-muted-foreground">{categoryLabel(user.category)}</span>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          Pendente
                        </Badge>
                      </div>

                      <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground">
                        Ao aprovar, o profissional será automaticamente cadastrado como <strong>{categoryLabel(user.category)}</strong> nas escalas de serviço.
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(user)}
                          className="flex-1"
                        >
                          <Check className="w-4 h-4 mr-1" /> Aprovar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(user)}
                          className="flex-1"
                        >
                          <X className="w-4 h-4 mr-1" /> Rejeitar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-5">
            {approvedUsers.length > 0 && (
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <Stethoscope className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    {approvedUsers.filter(u => u.category === 'nurse').length} Enfermeiro(s)
                  </span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <Syringe className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                    {approvedUsers.filter(u => u.category === 'tech').length} Técnico(s)
                  </span>
                </div>
              </div>
            )}
            {approvedUsers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Nenhum profissional na equipe ainda.</p>
                <p className="text-xs mt-1">Aprove solicitações da aba Pendentes para que eles apareçam aqui.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {approvedUsers.map(user => (
                  <Card key={user.id} className="overflow-hidden">
                    <div className={`h-1 w-full ${user.category === 'nurse' ? 'bg-emerald-400' : 'bg-blue-400'}`} />
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${user.category === 'nurse'
                          ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                          }`}>
                          {categoryIcon(user.category)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-sm text-foreground truncate">{user.full_name}</h3>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          <span className={`text-[11px] font-bold ${user.category === 'nurse' ? 'text-emerald-600' : 'text-blue-600'
                            }`}>
                            {categoryLabel(user.category)}
                          </span>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => handleRemoveApproved(user)}
                          title="Remover profissional"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
