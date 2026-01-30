import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useServiceSchedule } from '@/hooks/useServiceSchedule';
import { useAppData } from '@/hooks/useAppData';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ServiceScheduleNurses() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedProfessional, setSelectedProfessional] = useState<string>('');

    const { data } = useAppData();
    const { entries, addEntry, removeEntry, getEntriesForDate, calculateStats } = useServiceSchedule('nurse');

    const nurses = data.professionals.filter(p => {
        const func = data.functions.find(f => f.id === p.functionId);
        return func?.name.toLowerCase().includes('enferm');
    });

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startDayOfWeek = getDay(monthStart);

    const handlePreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

    const handleAddProfessional = () => {
        if (selectedDate && selectedProfessional) {
            addEntry(selectedProfessional, selectedDate);
            setSelectedProfessional('');
            setSelectedDate(null);
        }
    };

    const stats = calculateStats(nurses);

    return (
        <div className="animate-fade-in">
            <PageHeader
                title="Escala de Serviço - Enfermeiros"
                description="Gerenciamento de escalas mensais de eventos para enfermeiros"
            />

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
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-6">
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

                        return (
                            <div
                                key={dateStr}
                                className={cn(
                                    "min-h-[120px] border border-border p-2 hover:bg-muted/50 transition-colors",
                                    isToday && "bg-primary/5"
                                )}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className={cn(
                                        "text-sm font-semibold",
                                        isToday && "text-primary"
                                    )}>
                                        {format(day, 'd')}
                                    </span>
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-6 w-6 p-0"
                                                onClick={() => setSelectedDate(dateStr)}
                                            >
                                                <Plus className="w-3 h-3" />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent>
                                            <DialogHeader>
                                                <DialogTitle>
                                                    Adicionar Enfermeiro - {format(day, 'dd/MM/yyyy')}
                                                </DialogTitle>
                                            </DialogHeader>
                                            <div className="space-y-4">
                                                <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Selecione um enfermeiro" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {nurses.map(nurse => (
                                                            <SelectItem key={nurse.id} value={nurse.id}>
                                                                {nurse.name}
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

                                {/* Professionals for this day */}
                                <div className="space-y-1">
                                    {dayEntries.map(entry => {
                                        const professional = nurses.find(p => p.id === entry.professionalId);
                                        return (
                                            <div
                                                key={entry.id}
                                                className="text-xs bg-secondary/50 rounded px-1.5 py-0.5 flex items-center justify-between group"
                                            >
                                                <span className={cn(
                                                    entry.status === 'vacation' && "text-destructive",
                                                    entry.status === 'pregnant' && "text-destructive"
                                                )}>
                                                    {professional?.name}
                                                </span>
                                                <button
                                                    onClick={() => removeEntry(entry.id)}
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

            {/* Statistics */}
            <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                <h3 className="text-lg font-semibold mb-4">Estatísticas de Folgas</h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b">
                                <th className="text-left p-2">Enfermeiro</th>
                                <th className="text-center p-2">Dias Trabalhados</th>
                                <th className="text-center p-2">Folgas Devidas</th>
                                <th className="text-center p-2">Folgas Restantes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.filter(s => s.workedDays > 0).map(stat => (
                                <tr key={stat.professionalId} className="border-b">
                                    <td className="p-2">{stat.professionalName}</td>
                                    <td className="text-center p-2">{stat.workedDays}</td>
                                    <td className="text-center p-2 font-semibold text-primary">
                                        {stat.daysOffDue}
                                    </td>
                                    <td className="text-center p-2">{stat.remainingDaysOff}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
