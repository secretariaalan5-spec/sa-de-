import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAppData } from '@/hooks/useAppData';
import { useProfile } from '@/hooks/useProfile';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, RefreshCw, Link2, Users, Stethoscope, Syringe, Clock, X, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';

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
  const [activeTab, setActiveTab] = useState<'pending' | 'enfermeiros' | 'tecnicos' | 'emult'>('pending');

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

    toast.success(`${user.full_name} aprovado(a)!`);
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
    if (!confirm(`Remover ${user.full_name}?`)) return;

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
  const categoryColor = (cat: string) => cat === 'nurse' ? 'text-accent' : 'text-primary';
  const categoryBg = (cat: string) => cat === 'nurse' ? 'bg-accent/10' : 'bg-primary/10';

  if (!teamId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground">
        <RefreshCw className="w-6 h-6 animate-spin mb-3 opacity-30" />
        <p className="text-sm">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-8 max-w-3xl">
      <PageHeader
        title="Cadastro & Portal"
        description="Compartilhe o portal e gerencie sua equipe"
      />

      {/* Portal Link Section */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Link2 className="w-4 h-4 text-primary" />
            Link do Portal
          </div>

          <div className="font-mono text-xs bg-muted/60 rounded-lg px-3 py-2.5 break-all text-muted-foreground border border-border">
            {portalLink}
          </div>

          <div className="flex gap-2">
            <Button onClick={copyToClipboard} variant="outline" size="sm" className="flex-1 gap-2">
              {copied ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </Button>
            <Button onClick={shareOnWhatsApp} size="sm" className="flex-1 gap-2 bg-[#25D366] hover:bg-[#1da851] text-white border-0">
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
              WhatsApp
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Profissionais acessam o link, fazem login com Google, escolhem a categoria e aguardam sua aprovação.
          </p>
        </CardContent>
      </Card>

      {/* Tab Navigation */}
      <div>
        <div className="flex gap-1 bg-muted/50 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'pending'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Pendentes
            {pendingUsers.length > 0 && (
              <span className="bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {pendingUsers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-sm font-medium transition-all ${
              activeTab === 'team'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Equipe ({approvedUsers.length})
          </button>
        </div>

        {loadingApprovals && (
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
            <RefreshCw className="w-3 h-3 animate-spin" /> Atualizando...
          </p>
        )}
      </div>

      {/* Pending Tab */}
      {activeTab === 'pending' && (
        <div className="space-y-3">
          {pendingUsers.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma solicitação pendente</p>
            </div>
          ) : (
            pendingUsers.map(user => (
              <Card key={user.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${categoryBg(user.category)} ${categoryColor(user.category)}`}>
                    {user.category === 'nurse' ? <Stethoscope className="w-4 h-4" /> : <Syringe className="w-4 h-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{user.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    <span className={`text-[11px] font-medium ${categoryColor(user.category)}`}>
                      {categoryLabel(user.category)}
                    </span>
                  </div>

                  <div className="flex gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" className="h-8 gap-1 text-accent border-accent/30 hover:bg-accent/10" onClick={() => handleApprove(user)}>
                      <Check className="w-3.5 h-3.5" /> Aprovar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-destructive hover:bg-destructive/10" onClick={() => handleReject(user)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Team Tab */}
      {activeTab === 'team' && (
        <div className="space-y-3">
          {approvedUsers.length > 0 && (
            <div className="flex gap-4 text-xs font-medium text-muted-foreground">
              <span className="flex items-center gap-1">
                <Stethoscope className="w-3.5 h-3.5 text-accent" />
                {approvedUsers.filter(u => u.category === 'nurse').length} Enfermeiro(s)
              </span>
              <span className="flex items-center gap-1">
                <Syringe className="w-3.5 h-3.5 text-primary" />
                {approvedUsers.filter(u => u.category === 'tech').length} Técnico(s)
              </span>
            </div>
          )}

          {approvedUsers.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhum profissional na equipe</p>
              <p className="text-xs mt-1 opacity-70">Aprove solicitações pendentes para adicionar</p>
            </div>
          ) : (
            approvedUsers.map(user => (
              <Card key={user.id} className="group">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${categoryBg(user.category)} ${categoryColor(user.category)}`}>
                    {user.category === 'nurse' ? <Stethoscope className="w-4 h-4" /> : <Syringe className="w-4 h-4" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground truncate">{user.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    <span className={`text-[11px] font-medium ${categoryColor(user.category)}`}>
                      {categoryLabel(user.category)}
                    </span>
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={() => handleRemoveApproved(user)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
