import { useRef, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAppData } from '@/hooks/useAppData';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileDown, Printer, FileText } from 'lucide-react';
import { DAYS_OF_WEEK, PERIODS } from '@/types';

export default function Export() {
  const { data } = useAppData();
  const printRef = useRef<HTMLDivElement>(null);
  const [exportType, setExportType] = useState<'all' | 'function' | 'unit'>('all');
  const [selectedFunction, setSelectedFunction] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');

  const getProfessional = (id: string) => data.professionals.find(p => p.id === id);
  const getUnit = (id: string) => data.units.find(u => u.id === id);
  const getFunction = (id: string) => data.functions.find(f => f.id === id);

  const activeProfessionals = data.professionals.filter(p => p.active);
  const activeUnits = data.units.filter(u => u.active);

  // Group by function
  const professionalsByFunction = () => {
    const grouped: Record<string, typeof activeProfessionals> = {};

    const profsToShow = exportType === 'function' && selectedFunction
      ? activeProfessionals.filter(p => p.functionId === selectedFunction)
      : activeProfessionals;

    profsToShow.forEach(prof => {
      const funcId = prof.functionId;
      if (!grouped[funcId]) grouped[funcId] = [];
      grouped[funcId].push(prof);
    });
    return grouped;
  };

  // Get schedule text
  const getScheduleText = (professionalId: string, day: string) => {
    let entries = data.schedule.filter(
      s => s.professionalId === professionalId && s.dayOfWeek === day
    );

    if (exportType === 'unit' && selectedUnit) {
      entries = entries.filter(s => s.unitId === selectedUnit);
    }

    if (entries.length === 0) return '-';

    return entries.map(entry => {
      const unit = getUnit(entry.unitId);
      const period = PERIODS.find(p => p.key === entry.period);
      const periodSuffix = period?.key === 'manha' ? ' - MANHÃ' :
        period?.key === 'tarde' ? ' - TARDE' : '';
      return `${unit?.name || ''}${periodSuffix}`;
    }).join(' / ');
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
          <title>Escala eMult</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
            
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
            
            .schedule-section {
              margin-bottom: 30px;
              page-break-inside: avoid;
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
              border: 1px solid hsl(210, 100%, 48%);
            }
            
            td { 
              border: 1px solid #cbd5e1; 
              padding: 6px; 
              text-align: center; 
              vertical-align: middle;
            }
            
            tr:nth-child(even) { background: #f8fafc; }
            
            .section-title { 
              font-size: 14px; 
              font-weight: 700; 
              margin-bottom: 10px; 
              color: #0f172a;
              border-left: 4px solid hsl(210, 100%, 48%);
              padding-left: 10px;
              display: flex;
              align-items: center;
              background: #f1f5f9;
              padding: 8px 10px;
            }

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
            <h1>ESCALA eMULT</h1>
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

  const grouped = professionalsByFunction();

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Exportar Escala"
        description="Gere PDF da escala para impressão"
      />

      <div className="form-section mb-6">
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <Label>Tipo de Exportação</Label>
            <Select value={exportType} onValueChange={(v: any) => setExportType(v)}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                <SelectItem value="all">Escala Completa</SelectItem>
                <SelectItem value="function">Por Função</SelectItem>
                <SelectItem value="unit">Por Unidade</SelectItem>
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

          {exportType === 'unit' && (
            <div>
              <Label>Unidade</Label>
              <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {activeUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
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
          {Object.entries(grouped).map(([funcId, profs]) => {
            const func = getFunction(funcId);
            if (profs.length === 0) return null;

            return (
              <div key={funcId} className="schedule-section">
                <div
                  className="section-title"
                  style={{ borderLeftColor: func?.color || 'hsl(210, 100%, 48%)' }}
                >
                  PROFISSIONAL {func?.name?.toUpperCase()}
                </div>
                <table className="schedule-table text-xs">
                  <thead>
                    <tr>
                      <th className="text-left w-64" style={{ backgroundColor: 'hsl(210, 100%, 48%)' }}>PROFISSIONAL</th>
                      {DAYS_OF_WEEK.map(day => (
                        <th key={day.key} className="text-center" style={{ backgroundColor: 'hsl(210, 100%, 48%)' }}>{day.label.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {profs.map(prof => (
                      <tr key={prof.id}>
                        <td className="font-semibold text-left">{prof.name.toUpperCase()}</td>
                        {DAYS_OF_WEEK.map(day => (
                          <td key={day.key} className="text-center">
                            {getScheduleText(prof.id, day.key)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          {Object.keys(grouped).length === 0 && (
            <p className="text-center text-muted-foreground py-8">
              Nenhum dado para exibir
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
