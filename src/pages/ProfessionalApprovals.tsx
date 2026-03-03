import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, UserCheck, Clock, Users, Stethoscope, Syringe, AlertCircle } from 'lucide-react';
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
  const { professionals } = useServiceProfessionals();
  const { addRequest } = useLeaveRequests();
  const [pendingUsers, setPendingUsers] = useState<ProfessionalUserRecord[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<ProfessionalUserRecord[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<ProfLeaveRequest[]>([]);
  const [linkMap, setLinkMap] = useState<Record<string, string>>({});
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

  const handleApprove = async (user: ProfessionalUserRecord) => {
    const professionalId = linkMap[user.id];
    if (!professionalId) {
      toast.error('Selecione o profissional correspondente antes de aprovar.');
      return;
    }

    const { error } = await (supabase
      .from('professional_users' as any)
      .update({ status: 'approved', professional_id: professionalId } as any)
      .eq('id', user.id) as any);

    if (error) {
      toast.error('Erro ao aprovar');
      return;
    }

    toast.success(`${user.full_name} aprovado(a)!`);
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
  const categoryIcon = (cat: string) => cat === 'nurse' ? <Stethoscope className="w-4 h-4" /> : <Syringe className="w-4 h-4" />;

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
            <UserCheck className="w-4 h-4" />
            Aprovados ({approvedUsers.length})
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

                    <div>
                      <label className="text-xs font-medium text-muted-foreground mb-1 block">
                        Vincular ao profissional cadastrado:
                      </label>
                      <Select
                        value={linkMap[user.id] || ''}
                        onValueChange={(v) => setLinkMap(prev => ({ ...prev, [user.id]: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o profissional" />
                        </SelectTrigger>
                        <SelectContent>
                          {professionals
                            .filter(p => p.category === user.category && p.active)
                            .map(p => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleApprove(user)}
                        disabled={!linkMap[user.id]}
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

        {/* Approved users */}
        <TabsContent value="approved" className="space-y-4">
          {approvedUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">
              <UserCheck className="w-10 h-10 mx-auto mb-3 opacity-50" />
              Nenhum profissional aprovado ainda.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {approvedUsers.map(user => {
                const prof = professionals.find(p => p.id === user.professional_id);
                return (
                  <Card key={user.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          {categoryIcon(user.category)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-bold text-sm text-foreground truncate">{user.full_name}</h3>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          {prof && (
                            <p className="text-xs text-primary font-medium">→ {prof.name}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
