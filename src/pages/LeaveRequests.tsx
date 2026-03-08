import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Trash2, AlertCircle, Stethoscope, Syringe, Users, Check, X, CalendarOff } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { LeaveType, LEAVE_TYPE_LABELS } from '@/types/serviceSchedule';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

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
    const { requests, deleteRequest, addRequest } = useLeaveRequests();
    const { profile, logActivity } = useProfile();

    const [pendingPortalLeaves, setPendingPortalLeaves] = useState<ProfLeaveRequest[]>([]);
    const [avatarMap, setAvatarMap] = useState<Record<string, string>>({});

    const fetchPortalLeaves = useCallback(async () => {
        if (!profile?.team_id) return;
        const { data: leaves } = await (supabase
            .from('professional_leave_requests' as any)
            .select('*')
            .eq('team_id', profile.team_id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false }) as any);
        setPendingPortalLeaves((leaves || []) as ProfLeaveRequest[]);

        // Fetch avatars for professionals
        const { data: profUsers } = await supabase
            .from('professional_users')
            .select('professional_id, avatar_url')
            .eq('team_id', profile.team_id);
        if (profUsers) {
            const map: Record<string, string> = {};
            profUsers.forEach((pu: any) => {
                if (pu.professional_id && pu.avatar_url) map[pu.professional_id] = pu.avatar_url;
            });
            setAvatarMap(map);
        }
    }, [profile?.team_id]);

    useEffect(() => { fetchPortalLeaves(); }, [fetchPortalLeaves]);

    const handleApprovePortalLeave = async (leave: ProfLeaveRequest) => {
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
            observations: leave.observations || undefined,
            portalLeaveId: leave.id,
        });

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
            .eq('id', leave.id) as any);

        if (error) {
            toast.error('Erro ao rejeitar folga');
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
                    <div className="space-y-2">
                        {pendingPortalLeaves.map(leave => {
                            const prof = professionals.find(p => p.id === leave.professional_id);
                            const avatarUrl = avatarMap[leave.professional_id];
                            return (
                                <div key={leave.id} className="bg-card rounded-xl border border-border p-4 flex items-center gap-4">
                                    <Avatar className="h-10 w-10 shrink-0">
                                        {avatarUrl ? (
                                            <AvatarImage src={avatarUrl} alt={prof?.name || 'Profissional'} />
                                        ) : null}
                                        <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                                            {(prof?.name || 'P').slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold text-sm text-foreground truncate">{prof?.name || 'Profissional'}</span>
                                            {leave.category === 'nurse'
                                                ? <Stethoscope className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                                : <Syringe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                                            <Badge variant="secondary" className="text-[11px]">
                                                {LEAVE_TYPE_LABELS[leave.leave_type as LeaveType] || leave.leave_type}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                            <span>
                                                {format(new Date(leave.start_date + 'T00:00:00'), 'dd/MM')}
                                                {leave.end_date !== leave.start_date && (
                                                    <> a {format(new Date(leave.end_date + 'T00:00:00'), 'dd/MM')}</>
                                                )}
                                            </span>
                                            <span className="font-medium text-primary">
                                                {leave.days_requested} {leave.days_requested === 1 ? 'dia' : 'dias'}
                                            </span>
                                            {leave.observations && (
                                                <span className="italic truncate max-w-[150px]">"{leave.observations}"</span>
                                            )}
                                            <span className="hidden sm:inline">
                                                Enviado {format(new Date(leave.created_at), 'dd/MM HH:mm')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <Button size="sm" variant="outline" className="h-8 px-3" onClick={() => handleApprovePortalLeave(leave)}>
                                            <Check className="w-3.5 h-3.5 mr-1" /> Aprovar
                                        </Button>
                                        <Button size="sm" variant="destructive" className="h-8 px-3" onClick={() => handleRejectPortalLeave(leave)}>
                                            <X className="w-3.5 h-3.5 mr-1" /> Rejeitar
                                        </Button>
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
                    <div className="bg-card rounded-xl border border-border overflow-hidden">
                        <div className="grid grid-cols-[40px_1fr_auto_auto_auto_auto_auto] items-center gap-4 px-4 py-3 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground">
                            <span />
                            <span>Nome</span>
                            <span className="hidden sm:block w-28">Tipo</span>
                            <span className="w-24">Período</span>
                            <span className="w-16 text-center">Dias</span>
                            <span className="hidden md:block w-24">Registrado</span>
                            <span className="w-8" />
                        </div>

                        {[...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((request, idx) => {
                            const prof = professionals.find(p => p.id === request.professionalId);
                            const avatarUrl = avatarMap[request.professionalId];
                            const startDate = request.leaveDates[0];
                            const endDate = request.leaveDates[request.leaveDates.length - 1];

                            return (
                                <div
                                    key={request.id}
                                    className={`grid grid-cols-[40px_1fr_auto_auto_auto_auto_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40 ${idx < requests.length - 1 ? 'border-b border-border' : ''}`}
                                >
                                    <Avatar className="h-9 w-9 shrink-0">
                                        {avatarUrl ? <AvatarImage src={avatarUrl} alt={prof?.name || ''} /> : null}
                                        <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                                            {(prof?.name || 'P').slice(0, 2).toUpperCase()}
                                        </AvatarFallback>
                                    </Avatar>

                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-medium text-sm text-foreground truncate">{prof?.name || 'Desconhecido'}</span>
                                            {request.category === 'nurse'
                                                ? <Stethoscope className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                                : <Syringe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                                        </div>
                                        {request.observations && (
                                            <p className="text-[11px] text-muted-foreground italic truncate">{request.observations}</p>
                                        )}
                                    </div>

                                    <div className="hidden sm:block w-28">
                                        <Badge variant="secondary" className="text-[11px] whitespace-nowrap">
                                            {LEAVE_TYPE_LABELS[request.leaveType] || request.leaveType || '-'}
                                        </Badge>
                                    </div>

                                    <span className="text-xs text-foreground w-24">
                                        {startDate && format(new Date(startDate + 'T00:00:00'), 'dd/MM')}
                                        {endDate && endDate !== startDate && (
                                            <> a {format(new Date(endDate + 'T00:00:00'), 'dd/MM')}</>
                                        )}
                                    </span>

                                    <span className="text-xs font-semibold text-primary w-16 text-center">
                                        {request.daysRequested} {request.daysRequested === 1 ? 'dia' : 'dias'}
                                    </span>

                                    <span className="hidden md:block text-[11px] text-muted-foreground w-24">
                                        {format(new Date(request.requestDate + 'T00:00:00'), 'dd/MM/yyyy')}
                                    </span>

                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7 shrink-0"
                                        onClick={() => {
                                            const profName = prof?.name || 'Desconhecido';
                                            deleteRequest(request.id);
                                            logActivity('leave_request_deleted', {
                                                professionalName: profName,
                                                leaveType: LEAVE_TYPE_LABELS[request.leaveType] || request.leaveType,
                                            });
                                        }}
                                    >
                                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
