import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useServiceProfessionals } from '@/hooks/useServiceProfessionals';
import { useLeaveRequests } from '@/hooks/useLeaveRequests';
import { useServiceSchedule } from '@/hooks/useServiceSchedule';
import { useServiceStats } from '@/hooks/useServiceStats';
import { Stethoscope, Syringe, Calendar, TrendingUp, TrendingDown, Download, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { parseISO, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';

export default function IndividualControlPage() {
    const { professionals } = useServiceProfessionals();
    const { getTotalCreditsUsedByProfessional, getRequestsByProfessional } = useLeaveRequests();
    const { allEntries } = useServiceSchedule('nurse');

    const { getStatsForProfessional } = useServiceStats({
        allEntries,
        getTotalCreditsUsedByProfessional,
    });

    const getFullStatsForProfessional = (prof: typeof professionals[0]) => {
        const stats = getStatsForProfessional(prof.id, prof.name, prof.category);
        const leaveRequests = getRequestsByProfessional(prof.id);
        
        // Get weekend entries for PDF report
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const profEntries = allEntries.filter(e => e.professionalId === prof.id);
        const pastEntries = profEntries.filter(e => parseISO(e.date) <= today);
        const weekendEntries = pastEntries.filter(e => e.isWeekend);

        return {
            ...stats,
            totalWorkedDays: stats.workedDays,
            leaveRequestsCount: leaveRequests.length,
            weekendEntries,
        };
    };

    const downloadIndividualReport = (prof: typeof professionals[0]) => {
        const stats = getFullStatsForProfessional(prof);
        const leaveRequests = getRequestsByProfessional(prof.id);

        const reportDate = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

        // Create new PDF document
        const doc = new jsPDF();

        // Set font
        doc.setFont('helvetica');

        let yPosition = 15;
        const lineHeight = 6;
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 15;
        const contentWidth = pageWidth - (margin * 2);

        // Helper function to draw a box
        const drawBox = (x: number, y: number, width: number, height: number, fillColor?: number[]) => {
            if (fillColor) {
                doc.setFillColor(fillColor[0], fillColor[1], fillColor[2]);
                doc.rect(x, y, width, height, 'FD');
            } else {
                doc.setDrawColor(200, 200, 200);
                doc.rect(x, y, width, height);
            }
        };

        // Header with blue background
        doc.setFillColor(41, 98, 255); // Blue color
        doc.rect(0, 0, pageWidth, 35, 'F');

        // Title
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont('helvetica', 'bold');
        doc.text('CONTROLE INDIVIDUAL', pageWidth / 2, 15, { align: 'center' });
        doc.setFontSize(14);
        doc.text('Créditos e Folgas', pageWidth / 2, 23, { align: 'center' });

        yPosition = 45;
        doc.setTextColor(0, 0, 0);

        // Professional info box
        drawBox(margin, yPosition, contentWidth, 28, [245, 247, 250]);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('DADOS DO PROFISSIONAL', margin + 5, yPosition + 7);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(`Nome: ${prof.name}`, margin + 5, yPosition + 14);
        doc.text(`Categoria: ${prof.category === 'nurse' ? 'Enfermeiro(a)' : 'Técnico(a)'}`, margin + 5, yPosition + 20);

        const statusColor = prof.active ? [34, 197, 94] : [239, 68, 68];
        doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
        doc.setFont('helvetica', 'bold');
        doc.text(`STATUS: ${prof.active ? 'ATIVO' : 'INATIVO'}`, pageWidth - margin - 45, yPosition + 14);

        doc.setTextColor(100, 100, 100);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text(`Gerado em: ${reportDate}`, margin + 5, yPosition + 26);

        yPosition += 38;
        doc.setTextColor(0, 0, 0);

        // Credits summary with table
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(41, 98, 255);
        doc.text('RESUMO DE CRÉDITOS', margin, yPosition);
        yPosition += 8;
        doc.setTextColor(0, 0, 0);

        // Table header
        const rowHeight = 10;
        const col1Width = contentWidth * 0.65;
        const col2Width = contentWidth * 0.35;

        // Header row
        doc.setFillColor(41, 98, 255);
        doc.rect(margin, yPosition, col1Width, rowHeight, 'F');
        doc.rect(margin + col1Width, yPosition, col2Width, rowHeight, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Descrição', margin + 3, yPosition + 6.5);
        doc.text('Quantidade', margin + col1Width + 3, yPosition + 6.5);
        yPosition += rowHeight;

        // Table rows
        const tableData = [
            { label: 'Dias trabalhados (total)', value: stats.totalWorkedDays, color: [255, 255, 255] },
            { label: 'Dias em fins de semana', value: stats.weekendDays, color: [254, 249, 195] },
            { label: 'Créditos gerados', value: `${stats.creditsGenerated} dias`, color: [255, 255, 255] },
            { label: 'Créditos utilizados', value: `${stats.creditsUsed} dias`, color: [254, 226, 226] },
        ];

        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');

        tableData.forEach((row) => {
            // Alternate row colors
            doc.setFillColor(row.color[0], row.color[1], row.color[2]);
            doc.rect(margin, yPosition, col1Width, rowHeight, 'FD');
            doc.rect(margin + col1Width, yPosition, col2Width, rowHeight, 'FD');

            doc.text(row.label, margin + 3, yPosition + 6.5);
            doc.text(String(row.value), margin + col1Width + 3, yPosition + 6.5);
            yPosition += rowHeight;
        });

        // Balance row (highlighted)
        const balanceColor = stats.creditsBalance > 0 ? [220, 252, 231] : stats.creditsBalance < 0 ? [254, 226, 226] : [243, 244, 246];
        doc.setFillColor(balanceColor[0], balanceColor[1], balanceColor[2]);
        doc.rect(margin, yPosition, col1Width, rowHeight + 2, 'FD');
        doc.rect(margin + col1Width, yPosition, col2Width, rowHeight + 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('SALDO DISPONÍVEL', margin + 3, yPosition + 7.5);

        const textColor = stats.creditsBalance > 0 ? [22, 163, 74] : stats.creditsBalance < 0 ? [220, 38, 38] : [0, 0, 0];
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        doc.text(`${stats.creditsBalance} dias`, margin + col1Width + 3, yPosition + 7.5);
        doc.setTextColor(0, 0, 0);

        yPosition += rowHeight + 12;

        // Weekend entries section
        if (stats.weekendEntries.length > 0) {
            if (yPosition > pageHeight - 80) {
                doc.addPage();
                yPosition = 20;
            }

            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(41, 98, 255);
            doc.text('FINS DE SEMANA TRABALHADOS', margin, yPosition);
            yPosition += 8;
            doc.setTextColor(0, 0, 0);

            // Box for weekend entries
            const weekendBoxHeight = Math.min(stats.weekendEntries.length * 7 + 10, 60);
            drawBox(margin, yPosition, contentWidth, weekendBoxHeight, [250, 250, 250]);

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            yPosition += 7;

            stats.weekendEntries
                .sort((a, b) => a.date.localeCompare(b.date))
                .forEach((entry, index) => {
                    if (yPosition > pageHeight - 20) {
                        doc.addPage();
                        yPosition = 20;
                    }

                    const dateFormatted = format(parseISO(entry.date), "dd/MM/yyyy (EEEE)", { locale: ptBR });
                    doc.text(`${index + 1}. ${dateFormatted}`, margin + 5, yPosition);
                    yPosition += 7;
                });

            yPosition += 10;
        }

        // Leave requests section
        if (leaveRequests.length > 0) {
            if (yPosition > pageHeight - 80) {
                doc.addPage();
                yPosition = 20;
            }

            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(41, 98, 255);
            doc.text('HISTÓRICO DE FOLGAS UTILIZADAS', margin, yPosition);
            yPosition += 8;
            doc.setTextColor(0, 0, 0);

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');

            leaveRequests
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                .forEach((req, index) => {
                    if (yPosition > pageHeight - 30) {
                        doc.addPage();
                        yPosition = 20;
                    }

                    // Box for each request
                    const boxStartY = yPosition;
                    const requestDate = format(parseISO(req.requestDate), "dd/MM/yyyy", { locale: ptBR });
                    const leaveDates = req.leaveDates
                        .map(d => format(parseISO(d), "dd/MM/yyyy", { locale: ptBR }))
                        .join(', ');

                    let boxHeight = 20;
                    if (req.observations) boxHeight += 7;

                    drawBox(margin, yPosition, contentWidth, boxHeight, [245, 247, 250]);

                    yPosition += 6;
                    doc.setFont('helvetica', 'bold');
                    doc.text(`Pedido ${index + 1} - ${requestDate}`, margin + 5, yPosition);
                    doc.setFont('helvetica', 'normal');
                    doc.text(`${req.daysRequested} dia(s)`, pageWidth - margin - 25, yPosition);

                    yPosition += 6;
                    doc.setTextColor(80, 80, 80);
                    const datesText = `Datas: ${leaveDates}`;
                    const splitDates = doc.splitTextToSize(datesText, contentWidth - 10);
                    splitDates.forEach((line: string) => {
                        doc.text(line, margin + 5, yPosition);
                        yPosition += 5;
                    });

                    if (req.observations) {
                        yPosition += 1;
                        doc.setFont('helvetica', 'italic');
                        const obsText = `Obs: ${req.observations}`;
                        const splitObs = doc.splitTextToSize(obsText, contentWidth - 10);
                        splitObs.forEach((line: string) => {
                            doc.text(line, margin + 5, yPosition);
                            yPosition += 5;
                        });
                    }

                    doc.setTextColor(0, 0, 0);
                    yPosition = boxStartY + boxHeight + 5;
                });
        }

        // Footer
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.setFont('helvetica', 'italic');
        doc.text('Escala eMulti - Sistema de Gestão de Escalas', pageWidth / 2, pageHeight - 10, { align: 'center' });

        // Save the PDF
        doc.save(`controle-${prof.name.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    };

    const [searchTerm, setSearchTerm] = useState('');

    const filteredProfessionals = professionals.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const nurses = filteredProfessionals.filter(p => p.category === 'nurse');
    const techs = filteredProfessionals.filter(p => p.category === 'tech');

    const renderProfessionalCard = (prof: typeof professionals[0]) => {
        const stats = getFullStatsForProfessional(prof);

        return (
            <div key={prof.id} className="bg-card rounded-xl border border-border shadow-sm p-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        {prof.category === 'nurse' ? (
                            <Stethoscope className="w-5 h-5 text-primary" />
                        ) : (
                            <Syringe className="w-5 h-5 text-primary" />
                        )}
                        <h3 className="font-semibold">{prof.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        {!prof.active && (
                            <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded">
                                Inativo
                            </span>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => downloadIndividualReport(prof)}
                            title="Baixar controle individual"
                        >
                            <Download className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-muted/50 rounded-lg p-3">
                        <div className="flex items-center gap-1 text-muted-foreground text-xs mb-1">
                            <Calendar className="w-3 h-3" />
                            Dias Trabalhados
                        </div>
                        <div className="text-xl font-bold">{stats.totalWorkedDays}</div>
                    </div>

                    <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3">
                        <div className="text-amber-600 dark:text-amber-400 text-xs mb-1">
                            Fins de Semana
                        </div>
                        <div className="text-xl font-bold text-amber-700 dark:text-amber-300">
                            {stats.weekendDays}
                        </div>
                    </div>

                    <div className="bg-primary/5 rounded-lg p-3">
                        <div className="flex items-center gap-1 text-primary text-xs mb-1">
                            <TrendingUp className="w-3 h-3" />
                            Créditos Gerados
                        </div>
                        <div className="text-xl font-bold text-primary">{stats.creditsGenerated}</div>
                    </div>

                    <div className="bg-destructive/5 rounded-lg p-3">
                        <div className="flex items-center gap-1 text-destructive text-xs mb-1">
                            <TrendingDown className="w-3 h-3" />
                            Créditos Usados
                        </div>
                        <div className="text-xl font-bold text-destructive">{stats.creditsUsed}</div>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Saldo Disponível</span>
                        <span className={cn(
                            "text-2xl font-bold",
                            stats.creditsBalance > 0
                                ? "text-green-600 dark:text-green-400"
                                : stats.creditsBalance < 0
                                    ? "text-destructive"
                                    : "text-muted-foreground"
                        )}>
                            {stats.creditsBalance} dias
                        </span>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="animate-fade-in space-y-6">
            <PageHeader
                title="Controle Individual"
                description="Visualize os créditos e folgas de cada profissional"
            />

            <div className="relative max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Buscar profissional..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                />
            </div>

            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Stethoscope className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold">Enfermeiros</h2>
                </div>
                {nurses.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhum enfermeiro cadastrado.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {nurses.map(renderProfessionalCard)}
                    </div>
                )}
            </div>

            <div>
                <div className="flex items-center gap-2 mb-4">
                    <Syringe className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold">Técnicos</h2>
                </div>
                {techs.length === 0 ? (
                    <p className="text-muted-foreground text-sm">Nenhum técnico cadastrado.</p>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {techs.map(renderProfessionalCard)}
                    </div>
                )}
            </div>
        </div>
    );
}
