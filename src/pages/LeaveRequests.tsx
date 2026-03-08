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
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/EmptyState';

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

    const fetchPortalLeaves = useCallback(async () => {
        if (!profile?.team_id) return;
        const { data: leaves } = await (supabase
            .from('professional_leave_requests' as any)
            .select('*')
            .eq('team_id', profile.team_id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false }) as any);
        setPendingPortalLeaves((leaves || []) as ProfLeaveRequest[]);
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {pendingPortalLeaves.map(leave => {
                            const prof = professionals.find(p => p.id === leave.professional_id);
                            return (
                                <Card key={leave.id}>
                                    <CardContent className="p-5 space-y-3">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h3 className="font-bold text-foreground">{prof?.name || 'Profissional'}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {leave.category === 'nurse'
                                                        ? <Stethoscope className="w-4 h-4" />
                                                        : <Syringe className="w-4 h-4" />}
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
                                                <div className="font-bold text-primary">
                                                    {leave.days_requested} {leave.days_requested === 1 ? 'dia' : 'dias'}
                                                </div>
                                            </div>
                                        </div>

                                        {leave.observations && (
                                            <p className="text-xs text-muted-foreground italic">
                                                "{leave.observations}"
                                            </p>
                                        )}

                                        <div className="flex gap-2">
                                            <Button size="sm" onClick={() => handleApprovePortalLeave(leave)} className="flex-1">
                                                <Check className="w-4 h-4 mr-1" /> Aprovar
                                            </Button>
                                            <Button size="sm" variant="destructive" onClick={() => handleRejectPortalLeave(leave)} className="flex-1">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[...requests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(request => {
                            const prof = professionals.find(p => p.id === request.professionalId);
                            const startDate = request.leaveDates[0];
                            const endDate = request.leaveDates[request.leaveDates.length - 1];

                            return (
                                <div key={request.id} className="bg-card rounded-xl border border-border shadow-sm p-4 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            {request.category === 'nurse' ? (
                                                <Stethoscope className="w-4 h-4 text-primary" />
                                            ) : (
                                                <Syringe className="w-4 h-4 text-primary" />
                                            )}
                                            <span className="font-semibold text-sm">{prof?.name || 'Desconhecido'}</span>
                                        </div>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-7 w-7"
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

                                    <div className="flex flex-wrap gap-2">
                                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                            {request.category === 'nurse' ? 'Enfermeiro(a)' : 'Técnico(a)'}
                                        </span>
                                        <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                                            {LEAVE_TYPE_LABELS[request.leaveType] || request.leaveType || '-'}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div className="bg-muted/50 rounded-lg p-2">
                                            <div className="text-xs text-muted-foreground">Período</div>
                                            <div className="font-medium">
                                                {startDate && format(new Date(startDate + 'T00:00:00'), 'dd/MM')}
                                                {endDate && endDate !== startDate && (
                                                    <> a {format(new Date(endDate + 'T00:00:00'), 'dd/MM')}</>
                                                )}
                                            </div>
                                        </div>
                                        <div className="bg-muted/50 rounded-lg p-2">
                                            <div className="text-xs text-muted-foreground">Duração</div>
                                            <div className="font-bold text-primary">{request.daysRequested} {request.daysRequested === 1 ? 'dia' : 'dias'}</div>
                                        </div>
                                    </div>

                                    {request.observations && (
                                        <p className="text-xs text-muted-foreground italic border-t border-border pt-2">
                                            {request.observations}
                                        </p>
                                    )}

                                    <div className="text-[11px] text-muted-foreground">
                                        Registrado em {format(new Date(request.requestDate + 'T00:00:00'), 'dd/MM/yyyy')}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
