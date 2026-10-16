import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Printer, Loader2, FileSpreadsheet } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Employee {
  id: string;
  name: string;
  category_id: string | null;
  unit_id: string | null;
}

interface BalanceRow {
  employee: Employee;
  shifts: number;
  manual: number;
  used: number;
  balance: number;
  categoryName: string;
  unitName: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: BalanceRow[];
  filterUnitName?: string;
  filterCatName?: string;
}

const fmtCredit = (n: number) => (n % 1 === 0 ? n.toString() : n.toFixed(1).replace('.', ','));

export default function ReportExportDialog({
  open,
  onOpenChange,
  rows,
  filterUnitName,
  filterCatName,
}: Props) {
  const [loading, setLoading] = useState(false);

  // Gera layout limpo, tradicional e institucional para impressão e PDF
  const buildPrintHtml = (): string => {
    const totalShifts = rows.reduce((s, r) => s + r.shifts, 0);
    const totalManual = rows.reduce((s, r) => s + r.manual, 0);
    const totalUsed = rows.reduce((s, r) => s + r.used, 0);
    const totalBalance = rows.reduce((s, r) => s + r.balance, 0);

    const emissionDate = new Date().toLocaleString('pt-BR');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório de Saldo de Folgas — Saúde+</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #111827;
      background: #ffffff;
      padding: 24px;
      font-size: 12px;
      line-height: 1.4;
    }
    .header {
      border-bottom: 2px solid #1f2937;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .header-title h1 {
      font-size: 18px;
      font-weight: bold;
      color: #111827;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .header-title p {
      font-size: 12px;
      color: #4b5563;
      margin-top: 2px;
    }
    .header-meta {
      text-align: right;
      font-size: 11px;
      color: #4b5563;
    }
    .filters-box {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      padding: 8px 12px;
      margin-bottom: 16px;
      border-radius: 4px;
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      font-size: 11px;
    }
    .filters-box strong { color: #111827; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    .summary-item {
      border: 1px solid #d1d5db;
      border-radius: 4px;
      padding: 10px;
      text-align: center;
      background: #f9fafb;
    }
    .summary-item .label {
      font-size: 10px;
      text-transform: uppercase;
      color: #6b7280;
      font-weight: 600;
    }
    .summary-item .value {
      font-size: 16px;
      font-weight: bold;
      margin-top: 4px;
      color: #111827;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 8px 10px;
      text-align: left;
    }
    th {
      background: #f3f4f6;
      font-weight: bold;
      font-size: 11px;
      text-transform: uppercase;
      color: #374151;
    }
    tr:nth-child(even) { background: #fafafa; }
    td.num {
      text-align: center;
      font-family: monospace;
      font-size: 12px;
    }
    .footer {
      margin-top: 24px;
      border-top: 1px solid #e5e7eb;
      padding-top: 8px;
      text-align: center;
      font-size: 10px;
      color: #6b7280;
    }
    .actions-bar {
      margin-bottom: 16px;
      display: flex;
      gap: 8px;
    }
    .btn {
      padding: 8px 16px;
      background: #2563eb;
      color: #ffffff;
      border: none;
      border-radius: 4px;
      font-weight: bold;
      cursor: pointer;
      font-size: 12px;
    }
    .btn-close {
      background: #e5e7eb;
      color: #374151;
    }
    @media print {
      body { padding: 0; }
      .actions-bar { display: none !important; }
      th { background: #f3f4f6 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      tr { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="actions-bar">
    <button class="btn" onclick="window.print()">Imprimir / Salvar em PDF</button>
    <button class="btn btn-close" onclick="window.close()">Fechar</button>
  </div>

  <div class="header">
    <div class="header-title">
      <h1>Relatório Geral de Saldo de Folgas</h1>
      <p>Secretaria de Saúde • Sistema de Gestão de Escalas e Folgas</p>
    </div>
    <div class="header-meta">
      <p>Data de emissão: <strong>${emissionDate}</strong></p>
      <p>Total de profissionais: <strong>${rows.length}</strong></p>
    </div>
  </div>

  <div class="filters-box">
    <div>Filtro de Unidade: <strong>${filterUnitName || 'Todas as Unidades'}</strong></div>
    <div>Filtro de Categoria: <strong>${filterCatName || 'Todas as Categorias'}</strong></div>
  </div>

  <div class="summary-grid">
    <div class="summary-item">
      <div class="label">Plantões Extras</div>
      <div class="value">+${fmtCredit(totalShifts)}</div>
    </div>
    <div class="summary-item">
      <div class="label">Ajustes Manuais</div>
      <div class="value">${totalManual > 0 ? '+' : ''}${fmtCredit(totalManual)}</div>
    </div>
    <div class="summary-item">
      <div class="label">Folgas Usadas</div>
      <div class="value">-${fmtCredit(totalUsed)}</div>
    </div>
    <div class="summary-item">
      <div class="label">Saldo Total</div>
      <div class="value">${totalBalance > 0 ? '+' : ''}${fmtCredit(totalBalance)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 32%;">Profissional</th>
        <th style="width: 20%;">Categoria</th>
        <th style="width: 20%;">Unidade</th>
        <th style="width: 7%; text-align: center;">Plantões</th>
        <th style="width: 7%; text-align: center;">Manuais</th>
        <th style="width: 7%; text-align: center;">Usadas</th>
        <th style="width: 7%; text-align: center;">Saldo</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map(r => `
        <tr>
          <td><strong>${r.employee.name}</strong></td>
          <td>${r.categoryName}</td>
          <td>${r.unitName}</td>
          <td class="num">+${fmtCredit(r.shifts)}</td>
          <td class="num">${r.manual !== 0 ? (r.manual > 0 ? '+' : '') + fmtCredit(r.manual) : '—'}</td>
          <td class="num">-${fmtCredit(r.used)}</td>
          <td class="num" style="font-weight: bold;">${r.balance > 0 ? '+' : ''}${fmtCredit(r.balance)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    Documento emitido eletronicamente pelo Sistema de Gestão de Escalas • Página 1/1
  </div>
</body>
</html>`;
  };

  // 1. Abrir visualização direta para PDF / Impressão
  const handlePrintPdf = () => {
    setLoading(true);
    try {
      const html = buildPrintHtml();
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('O navegador bloqueou a abertura da janela. Permita popups para visualizar o relatório.');
        return;
      }
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Erro ao gerar PDF: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  // 2. Baixar Planilha Excel (CSV compatível com Excel pt-BR)
  const handleDownloadExcel = () => {
    setLoading(true);
    try {
      let csvContent = '\uFEFF'; // UTF-8 BOM
      csvContent += 'Profissional;Categoria;Unidade;Plantões Extras;Créditos Manuais;Folgas Usadas;Saldo Atual\n';
      rows.forEach(r => {
        csvContent += `"${r.employee.name}";"${r.categoryName}";"${r.unitName}";"${fmtCredit(r.shifts)}";"${fmtCredit(r.manual)}";"${fmtCredit(r.used)}";"${fmtCredit(r.balance)}"\n`;
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = `relatorio-saldos-${new Date().toISOString().slice(0, 10)}.csv`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Planilha Excel gerada com sucesso!');
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Erro ao exportar planilha: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Download size={18} className="text-primary" />
            Exportar Relatório Geral
          </DialogTitle>
          <DialogDescription className="text-xs">
            Gere o relatório em PDF para impressão ou baixe os dados em formato Excel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Dados a serem exportados */}
          <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Profissionais selecionados:</span>
              <strong className="text-foreground">{rows.length}</strong>
            </div>
            {filterUnitName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unidade:</span>
                <strong className="text-foreground">{filterUnitName}</strong>
              </div>
            )}
            {filterCatName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Categoria:</span>
                <strong className="text-foreground">{filterCatName}</strong>
              </div>
            )}
          </div>

          {/* Botões diretos: PDF e Excel */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Button
              className="gap-2 font-medium"
              onClick={handlePrintPdf}
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
              Gerar PDF
            </Button>

            <Button
              variant="outline"
              className="gap-2 font-medium"
              onClick={handleDownloadExcel}
              disabled={loading}
            >
              <FileSpreadsheet size={16} className="text-emerald-600" />
              Baixar Excel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
