import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ServiceProfessional, ServiceScheduleEntry, LeaveRequest, LEAVE_TYPE_LABELS } from '@/types/serviceSchedule';
import { toast } from 'sonner';

interface ServiceCalendarProps {
    type: 'nurse' | 'tech';
    typeLabel: string;
    professionals: ServiceProfessional[];
    entries: ServiceScheduleEntry[];
    onAddEntry: (professionalId: string, date: string) => boolean;
    onRemoveEntry: (entryId: string) => void;
    getEntriesForDate: (date: string) => ServiceScheduleEntry[];
    leaveRequests?: LeaveRequest[];
}

export function ServiceCalendar({
    type,
    typeLabel,
    professionals,
    entries,
    onAddEntry,
    onRemoveEntry,
    getEntriesForDate,
    leaveRequests = [],
}: ServiceCalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedProfessional, setSelectedProfessional] = useState<string>('');
    const [dialogOpen, setDialogOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [dialogSearchTerm, setDialogSearchTerm] = useState('');

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDayOfWeek = getDay(monthStart);

    const handlePreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

    const handleAddProfessional = () => {
        if (selectedDate && selectedProfessional) {
            // Check if professional is on leave on this date
            const isOnLeave = leaveRequests.some(r =>
                r.professionalId === selectedProfessional &&
                r.status === 'approved' &&
                r.leaveDates.includes(selectedDate)
            );
            if (isOnLeave) {
                toast.error('Este profissional está de folga/afastado nesta data.');
                return;
            }
            const success = onAddEntry(selectedProfessional, selectedDate);
            if (success) {
                setSelectedProfessional('');
                setDialogOpen(false);
                setDialogSearchTerm('');
            }
        }
    };

    const handleOpenDialog = (dateStr: string) => {
        setSelectedDate(dateStr);
        setDialogOpen(true);
        setDialogSearchTerm('');
    };

    // Filter professionals displayed in the calendar by search
    const highlightedProfessionalIds = useMemo(() => {
        if (!searchTerm.trim()) return null;
        const term = searchTerm.toLowerCase();
        return new Set(professionals.filter(p => p.name.toLowerCase().includes(term)).map(p => p.id));
    }, [searchTerm, professionals]);

    // Filter professionals in dialog
    const filteredDialogProfessionals = useMemo(() => {
        if (!dialogSearchTerm.trim()) return professionals;
        const term = dialogSearchTerm.toLowerCase();
        return professionals.filter(p => p.name.toLowerCase().includes(term));
    }, [dialogSearchTerm, professionals]);

    return (
        <div>
            {/* Month Navigation + Search */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={handlePreviousMonth}>
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <h2 className="text-xl font-bold capitalize min-w-[200px] text-center">
                        {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                    </h2>
                    <Button variant="outline" size="icon" onClick={handleNextMonth}>
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar profissional..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                    />
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                {/* Week Days Header */}
                <div className="grid grid-cols-7 bg-primary text-primary-foreground">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                        <div key={day} className="p-3 text-center font-semibold text-sm">
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7">
                    {Array.from({ length: startDayOfWeek }).map((_, i) => (
                        <div key={`empty-${i}`} className="min-h-[120px] border border-border bg-muted/30" />
                    ))}

                    {daysInMonth.map(day => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const dayEntries = getEntriesForDate(dateStr);
                        const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;
                        const isWeekendDay = isWeekend(day);

                        // Filter entries if searching
                        const visibleEntries = highlightedProfessionalIds
                            ? dayEntries.filter(e => highlightedProfessionalIds.has(e.professionalId))
                            : dayEntries;

                        return (
                            <div
                                key={dateStr}
                                className={cn(
                                    "min-h-[120px] border border-border p-2 transition-colors",
                                    isToday && "bg-primary/5",
                                    isWeekendDay && "bg-amber-50 dark:bg-amber-950/20"
                                )}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className={cn(
                                        "text-sm font-semibold",
                                        isToday && "text-primary",
                                        isWeekendDay && "text-amber-600 dark:text-amber-400"
                                    )}>
                                        {format(day, 'd')}
                                        {isWeekendDay && (
                                            <span className="ml-1 text-xs font-normal">(FDS)</span>
                                        )}
                                    </span>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0"
                                        onClick={() => handleOpenDialog(dateStr)}
                                    >
                                        <Plus className="w-3 h-3" />
                                    </Button>
                                </div>

                                <div className="space-y-1">
                                    {/* Exibir Afastamentos/Folgas primeiro */}
                                    {leaveRequests
                                        .filter(r => r.status === 'approved' && r.leaveDates.includes(dateStr))
                                        .map(request => {
                                            const professional = professionals.find(p => p.id === request.professionalId);
                                            // Only show if it matches the current category search/filter if we had one, 
                                            // but ServiceCalendar is already scoped to 'nurse' or 'tech' via props
                                            if (request.category !== type) return null;

                                            return (
                                                <div
                                                    key={request.id}
                                                    className="text-[10px] bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200 rounded px-1.5 py-0.5 font-bold border border-rose-200 dark:border-rose-800"
                                                    title={LEAVE_TYPE_LABELS[request.leaveType] || 'Afastado'}
                                                >
                                                    {professional?.name?.split(' ')[0]} ({LEAVE_TYPE_LABELS[request.leaveType]?.split(' ')[0] || 'Af.'})
                                                </div>
                                            );
                                        })}

                                    {visibleEntries.map(entry => {
                                        const professional = professionals.find(p => p.id === entry.professionalId);
                                        return (
                                            <div
                                                key={entry.id}
                                                className={cn(
                                                    "text-xs rounded px-1.5 py-0.5 flex items-center justify-between group",
                                                    entry.isWeekend
                                                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200"
                                                        : "bg-secondary/50"
                                                )}
                                            >
                                                <span className={cn(
                                                    entry.status === 'vacation' && "text-destructive line-through",
                                                    entry.status === 'pregnant' && "text-destructive"
                                                )}>
                                                    {professional?.name}
                                                </span>
                                                <button
                                                    onClick={() => onRemoveEntry(entry.id)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                    {/* Show count of hidden entries when filtering */}
                                    {highlightedProfessionalIds && dayEntries.length > visibleEntries.length && (
                                        <span className="text-[10px] text-muted-foreground">
                                            +{dayEntries.length - visibleEntries.length} ocultos
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Add Professional Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            Adicionar {typeLabel} - {selectedDate && format(parseDate(selectedDate), 'dd/MM/yyyy')}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar profissional..."
                                value={dialogSearchTerm}
                                onChange={(e) => setDialogSearchTerm(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                            <SelectTrigger>
                                <SelectValue placeholder={`Selecione um ${typeLabel.toLowerCase()}`} />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredDialogProfessionals.map(prof => (
                                    <SelectItem key={prof.id} value={prof.id}>
                                        {prof.name}
                                    </SelectItem>
                                ))}
                                {filteredDialogProfessionals.length === 0 && (
                                    <div className="py-2 px-3 text-sm text-muted-foreground text-center">
                                        Nenhum profissional encontrado
                                    </div>
                                )}
                            </SelectContent>
                        </Select>
                        <Button onClick={handleAddProfessional} className="w-full">
                            Adicionar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

function parseDate(dateStr: string): Date {
    return new Date(dateStr + 'T00:00:00');
}
