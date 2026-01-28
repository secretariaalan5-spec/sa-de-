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
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { font-size: 24px; margin-bottom: 5px; }
            .header p { color: #666; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #5c3a21; color: white; padding: 10px; font-size: 12px; }
            td { border: 1px solid #ddd; padding: 8px; font-size: 11px; text-align: center; }
            tr:nth-child(even) { background: #f9f9f9; }
            .section-title { font-size: 16px; font-weight: bold; margin: 20px 0 10px; padding-bottom: 5px; border-bottom: 2px solid #5c3a21; }
            @media print {
              th { background: #5c3a21 !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>ESCALA eMULT</h1>
            <p>Sistema de Gestão de Escalas</p>
          </div>
          ${printContent.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
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
              <div key={funcId}>
                <div className="section-title font-bold text-base mb-2 pb-1 border-b-2 border-primary">
                  PROFISSIONAL {func?.name?.toUpperCase()}
                </div>
                <table className="schedule-table text-xs">
                  <thead>
                    <tr>
                      <th className="text-left">PROFISSIONAL<br/>{func?.name?.toUpperCase()}</th>
                      {DAYS_OF_WEEK.map(day => (
                        <th key={day.key} className="text-center">{day.label.toUpperCase()}</th>
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
