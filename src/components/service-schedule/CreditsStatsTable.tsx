import { ServiceScheduleStats } from '@/types/serviceSchedule';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface CreditsStatsTableProps {
    stats: ServiceScheduleStats[];
    title: string;
}

export function CreditsStatsTable({ stats, title }: CreditsStatsTableProps) {
    const filteredStats = stats.filter(s => s.workedDays > 0 || s.creditsBalance !== 0);

    if (filteredStats.length === 0) {
        return null;
    }

    return (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-5 border-b border-border/50 bg-muted/20">
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
            </div>

            <ScrollArea className="h-full max-h-[450px] w-full">
                <div className="min-w-[800px]">
                    <table className="w-full border-collapse">
                        <thead className="sticky top-0 z-10 bg-card border-b shadow-sm">
                            <tr>
                                <th className="text-left p-4 text-[10px] uppercase font-bold text-muted-foreground">Profissional</th>
                                <th className="text-center p-4 text-[10px] uppercase font-bold text-muted-foreground">Dias Trab.</th>
                                <th className="text-center p-4 text-[10px] uppercase font-bold text-muted-foreground">Fins de Semana</th>
                                <th className="text-center p-4 text-[10px] uppercase font-bold text-muted-foreground">Créditos Gerados</th>
                                <th className="text-center p-4 text-[10px] uppercase font-bold text-muted-foreground">Créditos Usados</th>
                                <th className="text-center p-4 text-[10px] uppercase font-bold text-muted-foreground">Saldo Atual</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                            {filteredStats.map(stat => (
                                <tr key={stat.professionalId} className="hover:bg-muted/30 transition-colors">
                                    <td className="p-4">
                                        <span className="font-bold text-sm text-foreground">{stat.professionalName}</span>
                                    </td>
                                    <td className="text-center p-4">
                                        <span className="text-sm font-medium">{stat.workedDays}</span>
                                    </td>
                                    <td className="text-center p-4">
                                        <span className="inline-flex items-center justify-center min-w-8 h-6 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-2 rounded-full text-xs font-bold">
                                            {stat.weekendDays}
                                        </span>
                                    </td>
                                    <td className="text-center p-4">
                                        <span className="text-sm font-bold text-primary">
                                            {stat.creditsGenerated}
                                        </span>
                                    </td>
                                    <td className="text-center p-4">
                                        <span className="text-sm font-bold text-destructive">
                                            {stat.creditsUsed}
                                        </span>
                                    </td>
                                    <td className="text-center p-4">
                                        <span className={cn(
                                            "inline-flex items-center justify-center min-w-10 h-7 px-3 rounded-lg text-xs font-bold",
                                            stat.creditsBalance > 0
                                                ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 shadow-sm shadow-green-500/10"
                                                : stat.creditsBalance < 0
                                                    ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 shadow-sm shadow-red-500/10"
                                                    : "bg-muted text-muted-foreground"
                                        )}>
                                            {stat.creditsBalance > 0 ? `+${stat.creditsBalance}` : stat.creditsBalance}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>
    );
}
