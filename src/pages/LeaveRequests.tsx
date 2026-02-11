import { useState, useMemo } from 'react';
import { differenceInCalendarDays } from 'date-fns';
import { PageHeader } from '@/components/shared/PageHeader';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useServiceSchedule } from '@/hooks/useServiceSchedule';
import { useServiceStats } from '@/hooks/useServiceStats';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { LeaveType, LEAVE_TYPE_LABELS } from '@/types/serviceSchedule';

export default function LeaveRequestsPage() {
    const { professionals } = useServiceProfessionals();
    const { requests, addRequest, deleteRequest, getTotalCreditsUsedByProfessional } = useLeaveRequests();
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

            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted">
                            <tr>
                                <th className="text-left p-3">Profissional</th>
                                <th className="text-left p-3">Categoria</th>
                                <th className="text-left p-3">Tipo</th>
                                <th className="text-center p-3">Data do Pedido</th>
                                <th className="text-center p-3">Dias</th>
                                <th className="text-left p-3">Período</th>
                                <th className="text-left p-3">Observações</th>
                                <th className="text-center p-3">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {requests.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="text-center py-8 text-muted-foreground">
                                        Nenhum pedido de folga registrado.
                                    </td>
                                </tr>
                            ) : (
                                requests.map(request => {
                                    const prof = professionals.find(p => p.id === request.professionalId);
                                    return (
                                        <tr key={request.id} className="border-t">
                                            <td className="p-3 font-medium">{prof?.name || 'Desconhecido'}</td>
                                            <td className="p-3">
                                                <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-sm">
                                                    {request.category === 'nurse' ? 'Enfermeiro' : 'Técnico'}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <span className="bg-accent text-accent-foreground px-2 py-0.5 rounded text-sm">
                                                    {LEAVE_TYPE_LABELS[request.leaveType] || request.leaveType || '-'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                {format(new Date(request.requestDate + 'T00:00:00'), 'dd/MM/yyyy')}
                                            </td>
                                            <td className="p-3 text-center font-semibold">{request.daysRequested}</td>
                                            <td className="p-3 text-sm">
                                                {request.leaveDates.length > 0 && (
                                                    <>
                                                        {format(new Date(request.leaveDates[0] + 'T00:00:00'), 'dd/MM')}
                                                        {request.leaveDates.length > 1 && (
                                                            <> a {format(new Date(request.leaveDates[request.leaveDates.length - 1] + 'T00:00:00'), 'dd/MM')}</>
                                                        )}
                                                    </>
                                                )}
                                            </td>
                                            <td className="p-3 text-sm text-muted-foreground">
                                                {request.observations || '-'}
                                            </td>
                                            <td className="p-3 text-center">
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => deleteRequest(request.id)}
                                                >
                                                    <Trash2 className="w-4 h-4 text-destructive" />
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
