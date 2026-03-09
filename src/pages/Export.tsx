import { useRef, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAppData } from '@/hooks/useAppData';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, FileText, User, Users } from 'lucide-react';
import { DAYS_OF_WEEK, PERIODS } from '@/types';

export default function Export() {
  const { data } = useAppData();
  const printRef = useRef<HTMLDivElement>(null);
  const [exportType, setExportType] = useState<'all' | 'function' | 'professional'>('all');
  const [selectedFunction, setSelectedFunction] = useState('');
  const [selectedProfessional, setSelectedProfessional] = useState('');

  const getProfessional = (id: string) => data.professionals.find(p => p.id === id);
  const getUnit = (id: string) => data.units.find(u => u.id === id);
  const getFunction = (id: string) => data.functions.find(f => f.id === id);

  const activeProfessionals = data.professionals.filter(p => p.active);

  // Filter professionals based on export type
  const filteredProfessionals = () => {
    if (exportType === 'function' && selectedFunction) {
      return activeProfessionals.filter(p => p.functionId === selectedFunction);
    }
    if (exportType === 'professional' && selectedProfessional) {
      return activeProfessionals.filter(p => p.id === selectedProfessional);
    }
    return activeProfessionals;
  };

  // Get schedule entries for a professional on a specific day
  const getScheduleForDay = (professionalId: string, day: string) => {
    return data.schedule
      .filter(s => s.professionalId === professionalId && s.dayOfWeek === day)
      .map(entry => {
        const unit = getUnit(entry.unitId);
        const period = PERIODS.find(p => p.key === entry.period);
        const periodLabel = period?.key === 'manha' ? 'MANHÃ' :
          period?.key === 'tarde' ? 'TARDE' : 'INTEGRAL';
        return { unitName: unit?.name || '-', periodLabel };
      });
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Escala eMulti</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
            
            body { 
              font-family: 'Inter', Arial, sans-serif; 
              padding: 20px; 
              color: #1e293b;
              -webkit-print-color-adjust: exact; 
              print-color-adjust: exact;
            }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid hsl(210, 100%, 48%); padding-bottom: 20px; }
            .header h1 { font-size: 24px; margin: 0 0 5px 0; color: hsl(210, 100%, 48%); }
            .header p { color: #64748b; margin: 0; font-size: 14px; }
            
            .prof-card {
              margin-bottom: 24px;
              page-break-inside: avoid;
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              overflow: hidden;
            }

            .prof-header {
              background: #f1f5f9;
              padding: 10px 16px;
              display: flex;
              align-items: center;
              gap: 10px;
              border-bottom: 1px solid #e2e8f0;
            }

            .prof-color-dot {
              width: 12px;
              height: 12px;
              border-radius: 50%;
              flex-shrink: 0;
            }

            .prof-name {
              font-size: 14px;
              font-weight: 700;
              color: #0f172a;
            }

            .prof-function {
              font-size: 12px;
              color: #64748b;
              font-weight: 500;
            }
            
            table { 
              width: 100%; 
              border-collapse: collapse; 
              font-size: 11px;
            }
            
            th { 
              background: hsl(210, 100%, 48%) !important; 
              color: white !important; 
              padding: 8px; 
              font-weight: 600;
              text-transform: uppercase;
              border: 1px solid hsl(210, 100%, 42%);
            }
            
            td { 
              border: 1px solid #e2e8f0; 
              padding: 8px; 
              text-align: center; 
              vertical-align: middle;
              font-size: 11px;
            }
            
            tr:nth-child(even) td { background: #f8fafc; }

            .unit-name { font-weight: 600; color: #1e293b; }
            .period-label { font-size: 10px; color: #64748b; display: block; }

            .footer {
              position: fixed;
              bottom: 10px;
              right: 10px;
              font-size: 10px;
              color: #94a3b8;
            }
            
            @media print {
              @page { margin: 1cm; size: landscape; }
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>ESCALA eMulti</h1>
            <p>Secretaria de Saúde</p>
          </div>
          ${printContent.innerHTML}
          <div class="footer">
            Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const profsToShow = filteredProfessionals();

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Exportar Escala"
        description="Gere PDF da escala por profissional para impressão"
      />

      <div className="form-section mb-6">
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label>Filtro</Label>
            <Select value={exportType} onValueChange={(v: any) => setExportType(v)}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">Todos os Profissionais</SelectItem>
                <SelectItem value="function">Por Função</SelectItem>
                <SelectItem value="professional">Profissional Específico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {exportType === 'function' && (
            <div>
              <Label>Função</Label>
              <Select value={selectedFunction} onValueChange={setSelectedFunction}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {data.functions.map((f) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {exportType === 'professional' && (
            <div>
              <Label>Profissional</Label>
              <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {activeProfessionals.map((p) => {
                    const f = getFunction(p.functionId);
                    return (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} – {f?.name}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-end">
            <Button onClick={handlePrint} className="w-full sm:w-auto">
              <Printer className="w-4 h-4 mr-2" />
              Imprimir / PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="form-section">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Pré-visualização
        </h3>

        <div ref={printRef} className="space-y-6 overflow-x-auto">
          {profsToShow.map(prof => {
            const func = getFunction(prof.functionId);
            const hasSchedule = data.schedule.some(s => s.professionalId === prof.id);
            
            return (
              <div key={prof.id} className="prof-card rounded-lg border border-border overflow-hidden">
                {/* Professional header */}
                <div className="flex items-center gap-3 px-4 py-3 bg-muted/50 border-b border-border">
                  <div
                    className="w-3 h-3 rounded-full shrink-0 prof-color-dot"
                    style={{ backgroundColor: func?.color || '#888' }}
                  />
                  <div>
                    <span className="font-bold text-sm text-foreground prof-name">
                      {prof.name.toUpperCase()}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2 prof-function">
                      {func?.name || ''}
                    </span>
                  </div>
                </div>

                {/* Schedule table */}
                <table className="schedule-table text-xs w-full">
                  <thead>
                    <tr>
                      {DAYS_OF_WEEK.map(day => (
                        <th key={day.key} className="text-center" style={{ backgroundColor: 'hsl(210, 100%, 48%)' }}>
                          {day.label.toUpperCase()}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {DAYS_OF_WEEK.map(day => {
                        const dayEntries = getScheduleForDay(prof.id, day.key);
                        return (
                          <td key={day.key} className="text-center align-top p-2">
                            {dayEntries.length === 0 ? (
                              <span className="text-muted-foreground">-</span>
                            ) : (
                              <div className="space-y-1">
                                {dayEntries.map((entry, i) => (
                                  <div key={i}>
                                    <span className="font-semibold text-foreground unit-name">{entry.unitName}</span>
                                    <span className="text-muted-foreground text-[10px] block period-label">{entry.periodLabel}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}

          {profsToShow.length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Nenhum profissional para exibir
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
