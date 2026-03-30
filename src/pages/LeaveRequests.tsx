import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useProfile } from '@/hooks/useProfile';
import { useServiceSchedule } from '@/hooks/useServiceSchedule';
import { useServiceStats } from '@/hooks/useServiceStats';
import { Button } from '@/components/ui/button';
import { format, differenceInCalendarDays } from 'date-fns';
import { toast } from 'sonner';
import { LeaveType, LEAVE_TYPE_LABELS } from '@/types/serviceSchedule';
import { supabase } from '@/integrations/supabase/untyped-client';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { 
    Stethoscope, Syringe, Users, Check, X, CalendarOff, Trash2, 
    AlertCircle, Clock, Calendar, TrendingUp, TrendingDown, ChevronRight 
} from 'lucide-react';

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

export default function LeaveRequestsPage() {
    const { professionals } = useServiceProfessionals();
    const { requests, deleteRequest, addRequest, getConflictingDates, getTotalCreditsUsedByProfessional } = useLeaveRequests();
    const { profile, logActivity } = useProfile();

    const [pendingPortalLeaves, setPendingPortalLeaves] = useState<ProfLeaveRequest[]>([]);
    const [avatarMap, setAvatarMap] = useState<Record<string, string>>({});
    const [emailMap, setEmailMap] = useState<Record<string, string>>({});
    const [selectedProfId, setSelectedProfId] = useState<string | null>(null);

    // Get all entries for stats
    const { allEntries: nurseEntries } = useServiceSchedule('nurse');
    const { allEntries: techEntries } = useServiceSchedule('tech');
    const allEntries = useMemo(() => [...nurseEntries, ...techEntries], [nurseEntries, techEntries]);
    
    const { getStatsForProfessional: getStats } = useServiceStats({
        allEntries,
        getTotalCreditsUsedByProfessional,
    });

    const fetchPortalLeaves = useCallback(async () => {
        if (!profile?.team_id) return;
        const { data: leaves } = await (supabase
            .from('professional_leave_requests' as any)
            .select('*')
            .eq('team_id', profile.team_id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false }) as any);
        setPendingPortalLeaves((leaves || []) as ProfLeaveRequest[]);

        // Fetch avatars and emails for professionals
        const { data: profUsers } = await supabase
            .from('professional_users')
            .select('professional_id, avatar_url, email')
            .eq('team_id', profile.team_id);
        if (profUsers) {
            const aMap: Record<string, string> = {};
            const eMap: Record<string, string> = {};
            profUsers.forEach((pu: any) => {
                if (pu.professional_id) {
                    if (pu.avatar_url) aMap[pu.professional_id] = pu.avatar_url;
                    if (pu.email) eMap[pu.professional_id] = pu.email;
                }
            });
            setAvatarMap(aMap);
            setEmailMap(eMap);
        }
    }, [profile?.team_id]);

    useEffect(() => { fetchPortalLeaves(); }, [fetchPortalLeaves]);

    const handleApprovePortalLeave = async (leave: ProfLeaveRequest) => {
        // Build leave dates first to check conflicts
        const startDate = new Date(leave.start_date + 'T00:00:00');
        const leaveDates: string[] = [];
        for (let i = 0; i < leave.days_requested; i++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            leaveDates.push(format(d, 'yyyy-MM-dd'));
        }

        // Check for conflicts before approving
        const conflicts = getConflictingDates(leave.professional_id, leaveDates);
        if (conflicts.length > 0) {
            const formatted = conflicts.map(d => {
                const [y, m, day] = d.split('-');
                return `${day}/${m}`;
            }).join(', ');
            toast.error(`Conflito: já existe afastamento aprovado nas datas ${formatted}. Rejeite ou remova o afastamento existente primeiro.`);
            return;
        }

        const { error } = await (supabase
            .from('professional_leave_requests' as any)
            .update({ status: 'approved' } as any)
            .eq('id', leave.id)
            .select() as any);

        if (error) {
            console.error('Erro ao aprovar folga:', error);
            toast.error('Erro ao aprovar folga: ' + error.message);
            return;
        }

        const result = addRequest({
            professionalId: leave.professional_id,
            category: leave.category as 'nurse' | 'tech',
            leaveType: leave.leave_type as LeaveType,
            requestDate: format(new Date(), 'yyyy-MM-dd'),
            leaveDates,
            daysRequested: leave.days_requested,
            observations: leave.observations || undefined,
            portalLeaveId: leave.id,
        });

        if (result && 'error' in result) {
            toast.error(result.error as string);
            return;
        }

        const prof = professionals.find(p => p.id === leave.professional_id);
        toast.success(`Folga aprovada para ${prof?.name || 'profissional'}!`);
        logActivity('portal_leave_approved', {
            professionalName: prof?.name,
            leaveType: leave.leave_type,
            days: leave.days_requested,
        });
        fetchPortalLeaves();
    };

    const handleRejectPortalLeave = async (leave: ProfLeaveRequest) => {
        const { error } = await (supabase
            .from('professional_leave_requests' as any)
            .update({ status: 'rejected' } as any)
            .eq('id', leave.id)
            .select() as any);

        if (error) {
            console.error('Erro ao rejeitar folga:', error);
            toast.error('Erro ao rejeitar folga: ' + error.message);
            return;
        }

        toast.success('Pedido de folga rejeitado.');
        fetchPortalLeaves();
    };

    return (
        <div className="animate-fade-in space-y-6">
            <PageHeader
                title="Pedidos de Folga"
                description="Aprove pedidos enviados pelo portal e gerencie afastamentos registrados"
            />

            <div className="space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Pedidos enviados pelo Portal
                </h2>
                {pendingPortalLeaves.length === 0 ? (
                    <div className="text-sm text-muted-foreground bg-card rounded-xl border border-border p-4 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Nenhum pedido de folga pendente vindo do portal.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {pendingPortalLeaves.map(leave => {
                            const prof = professionals.find(p => p.id === leave.professional_id);
                            const avatarUrl = avatarMap[leave.professional_id];
                            const startDate = new Date(leave.start_date + 'T00:00:00');
                            const today = new Date(); today.setHours(0, 0, 0, 0);
                            const daysUntil = differenceInCalendarDays(startDate, today);
                            const isShortNotice = daysUntil < 10;
                            return (
                                <div key={leave.id} className={cn("bg-card rounded-2xl border p-5 shadow-sm hover:shadow-md transition-shadow", isShortNotice ? "border-warning/50" : "border-border")}>
                                    <div className="flex items-center gap-4">
                                        <Avatar className="h-12 w-12 shrink-0 ring-2 ring-primary/20 overflow-hidden">
                                            {avatarUrl && (
                                                <AvatarImage src={avatarUrl} alt={prof?.name || 'Profissional'} />
                                            )}
                                            <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                                                {(prof?.name || 'P').slice(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span 
                                                  className="font-bold text-sm text-foreground hover:text-primary cursor-pointer transition-colors"
                                                  onClick={() => setSelectedProfId(leave.professional_id)}
                                                >
                                                  {prof?.name || 'Profissional'}
                                                </span>
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-primary/30 text-primary">
                                                    {leave.category === 'nurse' ? 'Enfermeiro(a)' : 'Técnico(a)'}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                <Badge variant="secondary" className="text-[11px] font-medium">
                                                    {LEAVE_TYPE_LABELS[leave.leave_type as LeaveType] || leave.leave_type}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {format(new Date(leave.start_date + 'T00:00:00'), 'dd/MM')}
                                                    {leave.end_date !== leave.start_date && (
                                                        <> a {format(new Date(leave.end_date + 'T00:00:00'), 'dd/MM')}</>
                                                    )}
                                                </span>
                                                <span className="text-xs font-bold text-primary">
                                                    {leave.days_requested} {leave.days_requested === 1 ? 'dia' : 'dias'}
                                                </span>
                                                {isShortNotice && (
                                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-warning/50 text-warning bg-warning/10">
                                                        ⚠ Menos de 10 dias
                                                    </Badge>
                                                )}
                                            </div>
                                            {leave.observations && (
                                                <p className="text-[11px] text-muted-foreground italic mt-1 truncate">"{leave.observations}"</p>
                                            )}
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                Enviado em {format(new Date(leave.created_at), 'dd/MM/yyyy HH:mm')}
                                            </p>
                                        </div>

                                        <div className="flex flex-col gap-1.5 shrink-0">
                                            <Button size="sm" className="h-8 px-4 rounded-xl text-xs font-bold" onClick={() => handleApprovePortalLeave(leave)}>
                                                <Check className="w-3.5 h-3.5 mr-1" /> Aprovar
                                            </Button>
                                            <Button size="sm" variant="outline" className="h-8 px-4 rounded-xl text-xs font-medium text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleRejectPortalLeave(leave)}>
                                                <X className="w-3.5 h-3.5 mr-1" /> Rejeitar
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="space-y-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                    <CalendarOff className="w-4 h-4" />
                    Afastamentos Registrados
                </h2>

                {requests.length === 0 ? (
                    <EmptyState
                        icon={CalendarOff}
                        title="Nenhum afastamento registrado"
                        description="Os afastamentos aprovados pelo portal aparecerão aqui."
                    />
                ) : (
                    <div className="space-y-3">
                        {[...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((request) => {
                            const prof = professionals.find(p => p.id === request.professionalId);
                            const avatarUrl = avatarMap[request.professionalId];
                            const startDate = request.leaveDates[0];
                            const endDate = request.leaveDates[request.leaveDates.length - 1];

                            return (
                                <div
                                    key={request.id}
                                    className="bg-card rounded-2xl border border-border p-4 shadow-sm hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-center gap-4">
                                        <Avatar className="h-11 w-11 shrink-0 ring-2 ring-muted overflow-hidden">
                                            {avatarUrl && (
                                                <AvatarImage src={avatarUrl} alt={prof?.name || ''} />
                                            )}
                                            <AvatarFallback className="bg-muted text-muted-foreground text-xs font-bold">
                                                {(prof?.name || 'P').slice(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span 
                                                  className="font-bold text-sm text-foreground hover:text-primary cursor-pointer transition-colors"
                                                  onClick={() => setSelectedProfId(request.professionalId)}
                                                >
                                                  {prof?.name || 'Desconhecido'}
                                                </span>
                                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-muted-foreground/30">
                                                    {request.category === 'nurse' ? 'Enfermeiro(a)' : 'Técnico(a)'}
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                <Badge variant="secondary" className="text-[11px] font-medium">
                                                    {LEAVE_TYPE_LABELS[request.leaveType] || request.leaveType || '-'}
                                                </Badge>
                                                <span className="text-xs text-muted-foreground">
                                                    {startDate && format(new Date(startDate + 'T00:00:00'), 'dd/MM')}
                                                    {endDate && endDate !== startDate && (
                                                        <> a {format(new Date(endDate + 'T00:00:00'), 'dd/MM')}</>
                                                    )}
                                                </span>
                                                <span className="text-xs font-bold text-primary">
                                                    {request.daysRequested} {request.daysRequested === 1 ? 'dia' : 'dias'}
                                                </span>
                                            </div>
                                            {request.observations && (
                                                <p className="text-[11px] text-muted-foreground italic mt-1 truncate">{request.observations}</p>
                                            )}
                                            <p className="text-[10px] text-muted-foreground mt-1">
                                                Registrado em {format(new Date(request.requestDate + 'T00:00:00'), 'dd/MM/yyyy')}
                                            </p>
                                        </div>

                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-8 w-8 shrink-0 rounded-xl hover:bg-destructive/10"
                                            onClick={() => {
                                                const profName = prof?.name || 'Desconhecido';
                                                deleteRequest(request.id);
                                                logActivity('leave_request_deleted', {
                                                    professionalName: profName,
                                                    leaveType: LEAVE_TYPE_LABELS[request.leaveType] || request.leaveType,
                                                });
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Professional Detail Dialog */}
            <Dialog open={!!selectedProfId} onOpenChange={(open) => !open && setSelectedProfId(null)}>
                <DialogContent className="max-w-md rounded-3xl p-6 overflow-hidden">
                    {selectedProfId && (() => {
                        const prof = professionals.find(p => p.id === selectedProfId);
                        if (!prof) return null;
                        const stats = getStats(prof.id, prof.name, prof.category);
                        const avatarUrl = avatarMap[prof.id];
                        const email = emailMap[prof.id];
                        const isNurse = prof.category === 'nurse';

                        return (
                            <div className="space-y-6">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-bold flex items-center gap-3">
                                        <Avatar className="h-10 w-10">
                                            {avatarUrl && <AvatarImage src={avatarUrl} />}
                                            <AvatarFallback className="bg-primary/10 text-primary">
                                                {prof.name.slice(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p>{prof.name}</p>
                                            <p className="text-xs font-normal text-muted-foreground">{email || 'Sem e-mail'}</p>
                                        </div>
                                    </DialogTitle>
                                </DialogHeader>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/50 text-center">
                                        <TrendingUp className="w-4 h-4 mx-auto mb-1 text-accent" />
                                        <p className="text-2xl font-black text-accent">{stats.creditsGenerated}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Ganhos</p>
                                    </div>
                                    <div className="p-3.5 rounded-2xl bg-muted/30 border border-border/50 text-center">
                                        <TrendingDown className="w-4 h-4 mx-auto mb-1 text-destructive" />
                                        <p className="text-2xl font-black text-destructive">{stats.creditsUsed}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Usados</p>
                                    </div>
                                </div>

                                <div className="p-5 rounded-3xl bg-primary/5 border border-primary/10 text-center">
                                    <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em] mb-1">Saldo Atual</p>
                                    <p className={cn(
                                        "text-4xl font-black",
                                        stats.creditsBalance > 0 ? "text-accent" : stats.creditsBalance < 0 ? "text-destructive" : "text-muted-foreground"
                                    )}>
                                        {stats.creditsBalance}
                                        <span className="text-lg font-bold ml-1">dias</span>
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-wider">Informações</p>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between py-2 border-b border-border/10">
                                          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                            <Stethoscope className="w-3.5 h-3.5" /> Categoria
                                          </div>
                                          <Badge variant="outline" className="text-[10px]">
                                            {isNurse ? 'Enfermeiro(a)' : 'Técnico(a)'}
                                          </Badge>
                                        </div>
                                        <div className="flex items-center justify-between py-2 border-b border-border/10">
                                          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                            <Clock className="w-3.5 h-3.5" /> Carga Horária
                                          </div>
                                          <span className="text-xs font-bold">{prof.monthlyHours}h mensal</span>
                                        </div>
                                    </div>
                                </div>

                                <Button 
                                  className="w-full rounded-2xl h-12 font-bold"
                                  onClick={() => window.location.href = `/escalas-servicos/profissionais?id=${prof.id}`}
                                >
                                  Ver Histórico Completo
                                </Button>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </div>
    );
}
