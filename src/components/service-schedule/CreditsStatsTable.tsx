import { ServiceScheduleStats } from '@/types/serviceSchedule';
import { cn } from '@/lib/utils';

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
        <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <h3 className="text-lg font-semibold mb-4">{title}</h3>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b">
                            <th className="text-left p-2">Profissional</th>
                            <th className="text-center p-2">Dias Trabalhados</th>
                            <th className="text-center p-2">Fins de Semana</th>
                            <th className="text-center p-2">Créditos Gerados</th>
                            <th className="text-center p-2">Créditos Usados</th>
                            <th className="text-center p-2">Saldo</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredStats.map(stat => (
                            <tr key={stat.professionalId} className="border-b">
                                <td className="p-2 font-medium">{stat.professionalName}</td>
                                <td className="text-center p-2">{stat.workedDays}</td>
                                <td className="text-center p-2">
                                    <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded text-sm">
                                        {stat.weekendDays}
                                    </span>
                                </td>
                                <td className="text-center p-2 font-semibold text-primary">
                                    {stat.creditsGenerated}
                                </td>
                                <td className="text-center p-2 text-destructive">
                                    {stat.creditsUsed}
                                </td>
                                <td className="text-center p-2">
                                    <span className={cn(
                                        "px-2 py-0.5 rounded font-semibold",
                                        stat.creditsBalance > 0 
                                            ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                                            : stat.creditsBalance < 0
                                                ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
                                                : "bg-muted text-muted-foreground"
                                    )}>
                                        {stat.creditsBalance}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
