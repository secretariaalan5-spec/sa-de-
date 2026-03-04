import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, UserCheck, Clock, Users, Stethoscope, Syringe, AlertCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useProfile } from '@/hooks/useProfile';
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
  const { professionals, addProfessional, deleteProfessional } = useServiceProfessionals();
  const { addRequest } = useLeaveRequests();
  const [pendingUsers, setPendingUsers] = useState<ProfessionalUserRecord[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<ProfessionalUserRecord[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<ProfLeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!profile?.team_id) return;
    setLoading(true);

    // Fetch professional users for this team
    const { data: users } = await (supabase
      .from('professional_users' as any)
      .select('*')
      .eq('team_id', profile.team_id)
      .order('created_at', { ascending: false }) as any);

    const allUsers = (users || []) as ProfessionalUserRecord[];
    setPendingUsers(allUsers.filter(u => u.status === 'pending'));
    setApprovedUsers(allUsers.filter(u => u.status === 'approved'));

    // Fetch pending leave requests for this team
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

  /**
   * Ao aprovar, cria automaticamente o ServiceProfessional a partir dos dados do registro do usuário
   * e vincula o professional_id ao registro do professional_user.
   */
  const handleApprove = async (user: ProfessionalUserRecord) => {
    // Cria o ServiceProfessional automaticamente
    const newProf = addProfessional({
      name: user.full_name,
      category: user.category as 'nurse' | 'tech',
      monthlyHours: 200,
      active: true,
    });

    // Atualiza o registro do usuário com o ID do novo profissional
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

    // Remove o ServiceProfessional se existir
    if (user.professional_id) {
      deleteProfessional(user.professional_id);
    }

    // Remove o registro do professional_users
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
    // Update status in professional_leave_requests
    const { error } = await (supabase
      .from('professional_leave_requests' as any)
      .update({ status: 'approved' } as any)
      .eq('id', leave.id) as any);

    if (error) {
      toast.error('Erro ao aprovar folga');
      return;
    }

    // Also add to service state (admin's leave requests)
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

  const categoryLabel = (cat: string) => cat === 'nurse' ? 'Enfermeiro(a)' : cat === 'tech' ? 'Técnico(a)' : 'eMult';
  const categoryIcon = (cat: string) => cat === 'nurse' ? <Stethoscope className="w-4 h-4" /> : cat === 'tech' ? <Syringe className="w-4 h-4" /> : <Users className="w-4 h-4" />;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Aprovações do Portal"
        description="Gerencie solicitações de acesso e pedidos de folga dos profissionais"
      />

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
                        <p className="text-xs text-muted-foreground italic">
                          "{leave.observations}"
                        </p>
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

        {/* Equipe */}
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
                  {approvedUsers.filter(u => u.category === 'tech').length} Tecnico(s)
                </span>
              </div>
            </div>
          )}
          {approvedUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">
              <UserCheck className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Nenhum profissional na equipe ainda.</p>
              <p className="text-xs mt-1">Aprove solicitacoes da aba Pendentes para que eles aparecam aqui.</p>
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
  );
}
