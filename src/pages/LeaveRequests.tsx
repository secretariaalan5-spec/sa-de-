import { useState, useMemo } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { PageHeader } from '@/components/shared/PageHeader';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useServiceSchedule } from '@/hooks/useServiceSchedule';
import { useServiceStats } from '@/hooks/useServiceStats';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, AlertCircle, Stethoscope, Syringe } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { LeaveType, LEAVE_TYPE_LABELS } from '@/types/serviceSchedule';

export default function LeaveRequestsPage() {
    const { professionals } = useServiceProfessionals();
    const { requests, addRequest, deleteRequest, getTotalCreditsUsedByProfessional } = useLeaveRequests();
    const { logActivity } = useProfile();
    const { allEntries } = useServiceSchedule('nurse');

    const { getAvailableCredits } = useServiceStats({
        allEntries,
        getTotalCreditsUsedByProfessional,
    });

    const [dialogOpen, setDialogOpen] = useState(false);
    const [form, setForm] = useState({
        professionalId: '',
        leaveType: '' as LeaveType | '',
        requestDate: format(new Date(), 'yyyy-MM-dd'),
        leaveStartDate: '',
        leaveEndDate: '',
        observations: '',
    });

    const selectedProfessional = professionals.find(p => p.id === form.professionalId);
    const availableCredits = form.professionalId ? getAvailableCredits(form.professionalId) : 0;

    const daysRequested = useMemo(() => {
        if (!form.leaveStartDate || !form.leaveEndDate) return 0;
        const start = new Date(form.leaveStartDate + 'T00:00:00');
        const end = new Date(form.leaveEndDate + 'T00:00:00');
        if (end < start) return 0;
        return differenceInCalendarDays(end, start) + 1;
    }, [form.leaveStartDate, form.leaveEndDate]);

    const handleSubmit = () => {
        if (!form.professionalId || !form.leaveType || !form.leaveStartDate || !form.leaveEndDate || daysRequested < 1) {
            toast.error('Preencha todos os campos obrigatórios');
            return;
        }

        if (form.leaveType === 'folga_credito' && daysRequested > availableCredits) {
            toast.error(`Saldo insuficiente. Disponível: ${availableCredits} dias`);
            return;
        }

        // Check for date conflicts with existing leave requests
        const startDate = new Date(form.leaveStartDate + 'T00:00:00');
        const newLeaveDates: string[] = [];
        for (let i = 0; i < daysRequested; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            newLeaveDates.push(format(date, 'yyyy-MM-dd'));
        }

        const existingDates = requests
            .filter(r => r.professionalId === form.professionalId && r.status === 'approved')
            .flatMap(r => r.leaveDates);

        const conflictDate = newLeaveDates.find(d => existingDates.includes(d));
        if (conflictDate) {
            toast.error(`Já existe um afastamento registrado para ${format(new Date(conflictDate + 'T00:00:00'), 'dd/MM/yyyy')}`);
            return;
        }

        // Check for conflicts with schedule entries
        const scheduleConflict = newLeaveDates.find(d =>
            allEntries.some(e => e.professionalId === form.professionalId && e.date === d)
        );
        if (scheduleConflict) {
            toast.error(`Profissional está escalado em ${format(new Date(scheduleConflict + 'T00:00:00'), 'dd/MM/yyyy')}. Remova da escala antes.`);
            return;
        }

        addRequest({
            professionalId: form.professionalId,
            category: selectedProfessional?.category || 'nurse',
            leaveType: form.leaveType as LeaveType,
            requestDate: form.requestDate,
            leaveDates: newLeaveDates,
            daysRequested,
            observations: form.observations,
        });

        toast.success('Pedido de folga registrado com sucesso');
        logActivity('leave_request_created', {
            professionalName: selectedProfessional?.name,
            leaveType: LEAVE_TYPE_LABELS[form.leaveType as LeaveType],
            days: daysRequested,
        });
        setForm({
            professionalId: '',
            leaveType: '',
            requestDate: format(new Date(), 'yyyy-MM-dd'),
            leaveStartDate: '',
            leaveEndDate: '',
            observations: '',
        });
        setDialogOpen(false);
    };

    return (
        <div className="animate-fade-in space-y-6">
            <PageHeader
                title="Pedidos de Folga"
                description="Registre pedidos de folga recebidos em papel e controle o saldo de créditos"
            />

            <div className="flex justify-end">
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Registrar Folga
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Registrar Pedido de Folga</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <Label>Profissional</Label>
                                <Select
                                    value={form.professionalId}
                                    onValueChange={(value) => setForm(prev => ({ ...prev, professionalId: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o profissional" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {professionals.filter(p => p.active).map(prof => (
                                            <SelectItem key={prof.id} value={prof.id}>
                                                {prof.name} ({prof.category === 'nurse' ? 'Enfermeiro' : 'Técnico'})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {form.professionalId && form.leaveType === 'folga_credito' && (
                                <div className="p-3 bg-muted rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="w-4 h-4 text-primary" />
                                        <span className="text-sm">
                                            Saldo disponível: <strong className="text-primary">{availableCredits} dias</strong>
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div>
                                <Label>Tipo de Afastamento</Label>
                                <Select
                                    value={form.leaveType}
                                    onValueChange={(value) => setForm(prev => ({ ...prev, leaveType: value as LeaveType }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(Object.entries(LEAVE_TYPE_LABELS) as [LeaveType, string][]).map(([value, label]) => (
                                            <SelectItem key={value} value={value}>
                                                {label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Data do Pedido</Label>
                                <Input
                                    type="date"
                                    value={form.requestDate}
                                    onChange={(e) => setForm(prev => ({ ...prev, requestDate: e.target.value }))}
                                />
                            </div>

                            <div>
                                <Label>Data Inicial da Folga</Label>
                                <Input
                                    type="date"
                                    value={form.leaveStartDate}
                                    onChange={(e) => setForm(prev => ({ ...prev, leaveStartDate: e.target.value }))}
                                />
                            </div>

                            <div>
                                <Label>Data Final da Folga</Label>
                                <Input
                                    type="date"
                                    value={form.leaveEndDate}
                                    min={form.leaveStartDate || undefined}
                                    onChange={(e) => setForm(prev => ({ ...prev, leaveEndDate: e.target.value }))}
                                />
                            </div>

                            {daysRequested > 0 && (
                                <div className="p-3 bg-muted rounded-lg text-sm">
                                    Quantidade de dias: <strong>{daysRequested} {daysRequested === 1 ? 'dia' : 'dias'}</strong>
                                </div>
                            )}

                            <div>
                                <Label>Observações</Label>
                                <Textarea
                                    value={form.observations}
                                    onChange={(e) => setForm(prev => ({ ...prev, observations: e.target.value }))}
                                    placeholder="Ex: compensação, férias, licença..."
                                />
                            </div>

                            <Button
                                onClick={handleSubmit}
                                className="w-full"
                                disabled={daysRequested < 1 || (form.leaveType === 'folga_credito' && daysRequested > availableCredits)}
                            >
                                Registrar Folga
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {requests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">
                    Nenhum pedido de folga registrado.
                </div>
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
    );
}
