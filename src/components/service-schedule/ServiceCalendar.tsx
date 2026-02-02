import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ServiceProfessional, ServiceScheduleEntry } from '@/types/serviceSchedule';

interface ServiceCalendarProps {
    type: 'nurse' | 'tech';
    typeLabel: string;
    professionals: ServiceProfessional[];
    entries: ServiceScheduleEntry[];
    onAddEntry: (professionalId: string, date: string) => boolean;
    onRemoveEntry: (entryId: string) => void;
    getEntriesForDate: (date: string) => ServiceScheduleEntry[];
}

export function ServiceCalendar({
    type,
    typeLabel,
    professionals,
    entries,
    onAddEntry,
    onRemoveEntry,
    getEntriesForDate,
}: ServiceCalendarProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedProfessional, setSelectedProfessional] = useState<string>('');
    const [dialogOpen, setDialogOpen] = useState(false);

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDayOfWeek = getDay(monthStart);

    const handlePreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

    const handleAddProfessional = () => {
        if (selectedDate && selectedProfessional) {
            const success = onAddEntry(selectedProfessional, selectedDate);
            if (success) {
                setSelectedProfessional('');
                setDialogOpen(false);
            }
        }
    };

    const handleOpenDialog = (dateStr: string) => {
        setSelectedDate(dateStr);
        setDialogOpen(true);
    };

    return (
        <div>
            {/* Month Navigation */}
            <div className="flex items-center justify-between mb-6">
                <Button variant="outline" onClick={handlePreviousMonth}>
                    <ChevronLeft className="w-4 h-4" />
                </Button>
                <h2 className="text-2xl font-bold capitalize">
                    {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                </h2>
                <Button variant="outline" onClick={handleNextMonth}>
                    <ChevronRight className="w-4 h-4" />
                </Button>
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
                    {/* Empty cells for days before month start */}
                    {Array.from({ length: startDayOfWeek }).map((_, i) => (
                        <div key={`empty-${i}`} className="min-h-[120px] border border-border bg-muted/30" />
                    ))}

                    {/* Days of the month */}
                    {daysInMonth.map(day => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const dayEntries = getEntriesForDate(dateStr);
                        const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;
                        const isWeekendDay = isWeekend(day);

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

                                {/* Professionals for this day */}
                                <div className="space-y-1">
                                    {dayEntries.map(entry => {
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
                        <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                            <SelectTrigger>
                                <SelectValue placeholder={`Selecione um ${typeLabel.toLowerCase()}`} />
                            </SelectTrigger>
                            <SelectContent>
                                {professionals.map(prof => (
                                    <SelectItem key={prof.id} value={prof.id}>
                                        {prof.name}
                                    </SelectItem>
                                ))}
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
