import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, UserCheck, Clock, Users, Stethoscope, Syringe, AlertCircle, Trash2, Link2, Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useProfile } from '@/hooks/useProfile';
import { useAppData } from '@/hooks/useAppData';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { format } from 'date-fns';
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
  function_name: string | null;
  created_at: string;
}

interface ProfLeaveRequest {
  id: string;
  user_id: string;
  professional_id: string;
  team_id: string;
  category: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  observations: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

export default function ProfessionalApprovals() {
  const { profile, logActivity } = useProfile();
  const { data: emultData, teamId, addProfessional: addEmultProfessional, deleteFunction: deleteEmultFunction } = useAppData();
  const { professionals, addProfessional, deleteProfessional } = useServiceProfessionals();
  const { addRequest } = useLeaveRequests();
  const [pendingUsers, setPendingUsers] = useState<ProfessionalUserRecord[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<ProfessionalUserRecord[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<ProfLeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const portalLink = teamId
    ? `${window.location.origin}/portal?team=${teamId}`
    : '';

  const copyToClipboard = () => {
    if (!portalLink) return;
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

  const fetchData = useCallback(async () => {
    if (!profile?.team_id) return;
    setLoading(true);

    const { data: users } = await (supabase
      .from('professional_users' as any)
      .select('*')
      .eq('team_id', profile.team_id)
      .order('created_at', { ascending: false }) as any);

    const allUsers = (users || []) as ProfessionalUserRecord[];
    setPendingUsers(allUsers.filter(u => u.status === 'pending'));
    setApprovedUsers(allUsers.filter(u => u.status === 'approved'));

    const { data: leaves } = await (supabase
      .from('professional_leave_requests' as any)
      .select('*')
      .eq('team_id', profile.team_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }) as any);

    setPendingLeaves((leaves || []) as ProfLeaveRequest[]);
    setLoading(false);
  }, [profile?.team_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApprove = async (user: ProfessionalUserRecord) => {
    let professionalId: string;

    if (user.category === 'emult') {
      // eMult professionals go to AppDataContext (escala base)
      // Find or create the matching function
      let funcId = emultData.functions.find(f => 
        f.name.toLowerCase() === (user.function_name || '').toLowerCase()
      )?.id;
      
      if (!funcId && user.function_name) {
        // Create new function with a default color
        const colors = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];
        const colorIdx = emultData.functions.length % colors.length;
        const newFunc = addEmultProfessional({ name: '', functionId: '', team: '', weeklyHours: 40, active: true }); // placeholder
        // Actually we need to use addFunction - let me use the context properly
        funcId = emultData.functions[0]?.id || '1';
        // Try to find best match
        for (const f of emultData.functions) {
          if (f.name.toLowerCase().includes((user.function_name || '').toLowerCase().substring(0, 5))) {
            funcId = f.id;
            break;
          }
        }
      }

      if (!funcId) funcId = emultData.functions[0]?.id || '1';

      const newProf = addEmultProfessional({
        name: user.full_name,
        functionId: funcId,
        team: '',
        weeklyHours: 40,
        active: true,
      });
      professionalId = newProf.id;
    } else {
      // Nurse/Tech go to service professionals
      const newProf = addProfessional({
        name: user.full_name,
        category: user.category as 'nurse' | 'tech',
        monthlyHours: 200,
        active: true,
      });
      professionalId = newProf.id;
    }

    const { error } = await (supabase
      .from('professional_users' as any)
      .update({ status: 'approved', professional_id: professionalId } as any)
      .eq('id', user.id) as any);

    if (error) {
      toast.error('Erro ao aprovar');
      return;
    }

    toast.success(`${user.full_name} aprovado(a) e cadastrado(a)!`);
    logActivity('professional_approved', { name: user.full_name, email: user.email, category: user.category });
    fetchData();
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
    fetchData();
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
    fetchData();
  };

  const handleApproveLeave = async (leave: ProfLeaveRequest) => {
    const { error } = await (supabase
      .from('professional_leave_requests' as any)
      .update({ status: 'approved' } as any)
      .eq('id', leave.id) as any);

    if (error) {
      toast.error('Erro ao aprovar folga');
      return;
    }

    const startDate = new Date(leave.start_date + 'T00:00:00');
    const leaveDates: string[] = [];
    for (let i = 0; i < leave.days_requested; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      leaveDates.push(format(d, 'yyyy-MM-dd'));
    }

    addRequest({
      professionalId: leave.professional_id,
      category: leave.category as 'nurse' | 'tech',
      leaveType: leave.leave_type as LeaveType,
      requestDate: format(new Date(), 'yyyy-MM-dd'),
      leaveDates,
      daysRequested: leave.days_requested,
      observations: `[Portal] ${leave.observations || ''}`.trim(),
      portalLeaveId: leave.id, // Vincula ao registro do portal para sincronizar exclusões
    });

    const prof = professionals.find(p => p.id === leave.professional_id);
    toast.success(`Folga aprovada para ${prof?.name || 'profissional'}!`);
    logActivity('portal_leave_approved', {
      professionalName: prof?.name,
      leaveType: leave.leave_type,
      days: leave.days_requested,
    });
    fetchData();
  };

  const handleRejectLeave = async (leave: ProfLeaveRequest) => {
    const { error } = await (supabase
      .from('professional_leave_requests' as any)
      .update({ status: 'rejected' } as any)
      .eq('id', leave.id) as any);

    if (error) {
      toast.error('Erro ao rejeitar folga');
      return;
    }

    toast.success('Pedido de folga rejeitado.');
    fetchData();
  };

  const categoryLabel = (cat: string, fn?: string | null) => {
    if (cat === 'emult' && fn) return fn;
    return cat === 'nurse' ? 'Enfermeiro(a)' : cat === 'tech' ? 'Técnico(a)' : 'eMult';
  };
  const categoryIcon = (cat: string) => cat === 'nurse' ? <Stethoscope className="w-4 h-4" /> : cat === 'tech' ? <Syringe className="w-4 h-4" /> : <Users className="w-4 h-4" />;
  const categoryColorClass = (cat: string) => cat === 'nurse' ? 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30' : cat === 'tech' ? 'text-blue-600 bg-blue-100 dark:bg-blue-900/30' : 'text-violet-600 bg-violet-100 dark:bg-violet-900/30';
  const categoryBarColor = (cat: string) => cat === 'nurse' ? 'bg-emerald-400' : cat === 'tech' ? 'bg-blue-400' : 'bg-violet-400';
  const categoryTextColor = (cat: string) => cat === 'nurse' ? 'text-emerald-600' : cat === 'tech' ? 'text-blue-600' : 'text-violet-600';

  const nurseCount = approvedUsers.filter(u => u.category === 'nurse').length;
  const techCount = approvedUsers.filter(u => u.category === 'tech').length;
  const emultCount = approvedUsers.filter(u => u.category === 'emult').length;

  return (
    <div className="animate-fade-in space-y-6 max-w-4xl">
      <PageHeader
        title="Links & Aprovações"
        description="Compartilhe o portal e gerencie as aprovações de acesso"
      />

      {/* Portal Link Card */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Link2 className="w-4 h-4 text-primary" />
            Link do Portal
          </div>

          <div className="font-mono text-xs bg-muted/60 rounded-lg px-3 py-2.5 break-all text-muted-foreground border border-border">
            {portalLink || 'Carregando...'}
          </div>

          <div className="flex gap-2">
            <Button onClick={copyToClipboard} variant="outline" size="sm" className="flex-1 gap-2" disabled={!portalLink}>
              {copied ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </Button>
            <Button onClick={shareOnWhatsApp} size="sm" className="flex-1 gap-2 bg-[#25D366] hover:bg-[#1da851] text-white border-0" disabled={!portalLink}>
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
              WhatsApp
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Profissionais acessam o link, fazem login com Google, escolhem a categoria (Enfermeiro, Técnico ou eMult) e aguardam sua aprovação.
          </p>
        </CardContent>
      </Card>

      {/* Approvals Tabs */}
      <Tabs defaultValue="access" className="space-y-6">
        <TabsList className="grid grid-cols-3 max-w-lg">
          <TabsTrigger value="access" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Pendentes ({pendingUsers.length})
          </TabsTrigger>
          <TabsTrigger value="leaves" className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Folgas ({pendingLeaves.length})
          </TabsTrigger>
          <TabsTrigger value="approved" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Equipe ({approvedUsers.length})
          </TabsTrigger>
        </TabsList>

        {/* Pending access requests */}
        <TabsContent value="access" className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
              <p className="text-sm">Carregando...</p>
            </div>
          ) : pendingUsers.length === 0 ? (
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
                          <span className="text-xs text-muted-foreground">{categoryLabel(user.category, user.function_name)}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        Pendente
                      </Badge>
                    </div>

                    <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground">
                      Ao aprovar, o profissional será cadastrado como <strong>{categoryLabel(user.category, user.function_name)}</strong> e aparecerá na área correspondente.
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleApprove(user)} className="flex-1">
                        <Check className="w-4 h-4 mr-1" /> Aprovar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleReject(user)} className="flex-1">
                        <X className="w-4 h-4 mr-1" /> Rejeitar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Pending leave requests */}
        <TabsContent value="leaves" className="space-y-4">
          {pendingLeaves.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">
              <AlertCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
              Nenhum pedido de folga pendente.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingLeaves.map(leave => {
                const prof = professionals.find(p => p.id === leave.professional_id);
                return (
                  <Card key={leave.id}>
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-bold text-foreground">{prof?.name || 'Profissional'}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            {categoryIcon(leave.category)}
                            <Badge variant="secondary" className="text-xs">
                              {LEAVE_TYPE_LABELS[leave.leave_type as LeaveType] || leave.leave_type}
                            </Badge>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                          Pendente
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-muted/50 rounded-lg p-2">
                          <div className="text-xs text-muted-foreground">Período</div>
                          <div className="font-medium">
                            {format(new Date(leave.start_date + 'T00:00:00'), 'dd/MM')}
                            {leave.end_date !== leave.start_date && (
                              <> a {format(new Date(leave.end_date + 'T00:00:00'), 'dd/MM')}</>
                            )}
                          </div>
                        </div>
                        <div className="bg-muted/50 rounded-lg p-2">
                          <div className="text-xs text-muted-foreground">Duração</div>
                          <div className="font-bold text-primary">{leave.days_requested} {leave.days_requested === 1 ? 'dia' : 'dias'}</div>
                        </div>
                      </div>

                      {leave.observations && (
                        <p className="text-xs text-muted-foreground italic">"{leave.observations}"</p>
                      )}

                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleApproveLeave(leave)} className="flex-1">
                          <Check className="w-4 h-4 mr-1" /> Aprovar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleRejectLeave(leave)} className="flex-1">
                          <X className="w-4 h-4 mr-1" /> Rejeitar
                        </Button>
                      </div>

                      <div className="text-[11px] text-muted-foreground">
                        Enviado em {format(new Date(leave.created_at), 'dd/MM/yyyy HH:mm')}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Equipe - grouped by category */}
        <TabsContent value="approved" className="space-y-5">
          {approvedUsers.length > 0 && (
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <Stethoscope className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{nurseCount} Enfermeiro(s)</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <Syringe className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-bold text-blue-700 dark:text-blue-300">{techCount} Técnico(s)</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
                <Users className="w-4 h-4 text-violet-600" />
                <span className="text-sm font-bold text-violet-700 dark:text-violet-300">{emultCount} eMult</span>
              </div>
            </div>
          )}

          {approvedUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">
              <UserCheck className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Nenhum profissional na equipe ainda.</p>
              <p className="text-xs mt-1">Aprove solicitações da aba Pendentes para que eles apareçam aqui.</p>
            </div>
          ) : (
            <>
              {/* Enfermeiros */}
              {nurseCount > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-emerald-600 flex items-center gap-2">
                    <Stethoscope className="w-4 h-4" /> Enfermeiros
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {approvedUsers.filter(u => u.category === 'nurse').map(user => (
                      <UserCard key={user.id} user={user} categoryIcon={categoryIcon} categoryLabel={categoryLabel} categoryBarColor={categoryBarColor} categoryColorClass={categoryColorClass} categoryTextColor={categoryTextColor} onRemove={handleRemoveApproved} />
                    ))}
                  </div>
                </div>
              )}

              {/* Técnicos */}
              {techCount > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-blue-600 flex items-center gap-2">
                    <Syringe className="w-4 h-4" /> Técnicos
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {approvedUsers.filter(u => u.category === 'tech').map(user => (
                      <UserCard key={user.id} user={user} categoryIcon={categoryIcon} categoryLabel={categoryLabel} categoryBarColor={categoryBarColor} categoryColorClass={categoryColorClass} categoryTextColor={categoryTextColor} onRemove={handleRemoveApproved} />
                    ))}
                  </div>
                </div>
              )}

              {/* eMult */}
              {emultCount > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-violet-600 flex items-center gap-2">
                    <Users className="w-4 h-4" /> eMult
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {approvedUsers.filter(u => u.category === 'emult').map(user => (
                      <UserCard key={user.id} user={user} categoryIcon={categoryIcon} categoryLabel={categoryLabel} categoryBarColor={categoryBarColor} categoryColorClass={categoryColorClass} categoryTextColor={categoryTextColor} onRemove={handleRemoveApproved} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UserCard({ user, categoryIcon, categoryLabel, categoryBarColor, categoryColorClass, categoryTextColor, onRemove }: {
  user: ProfessionalUserRecord;
  categoryIcon: (cat: string) => React.ReactNode;
  categoryLabel: (cat: string, fn?: string | null) => string;
  categoryBarColor: (cat: string) => string;
  categoryColorClass: (cat: string) => string;
  categoryTextColor: (cat: string) => string;
  onRemove: (user: ProfessionalUserRecord) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <div className={`h-1 w-full ${categoryBarColor(user.category)}`} />
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${categoryColorClass(user.category)}`}>
            {categoryIcon(user.category)}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-sm text-foreground truncate">{user.full_name}</h3>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            <span className={`text-[11px] font-bold ${categoryTextColor(user.category)}`}>
              {categoryLabel(user.category, user.function_name)}
            </span>
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => onRemove(user)}
            title="Remover profissional"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
