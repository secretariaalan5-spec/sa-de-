import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileText, Download, Printer, Loader2, Wallet } from 'lucide-react';
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

  // Constrói o HTML estilizado, moderno e responsivo do Panorama Geral
  const buildHtmlReport = (): string => {
    const totalShifts = rows.reduce((s, r) => s + r.shifts, 0);
    const totalManual = rows.reduce((s, r) => s + r.manual, 0);
    const totalUsed = rows.reduce((s, r) => s + r.used, 0);
    const totalBalance = rows.reduce((s, r) => s + r.balance, 0);

    const title = 'Relatório de Saldo de Folgas';
    const subtitle = 'Panorama geral de plantões extras, ajustes manuais, folgas usadas e saldo final';

    const filterTags: string[] = [];
    if (filterUnitName) filterTags.push(`Unidade: ${filterUnitName}`);
    if (filterCatName) filterTags.push(`Categoria: ${filterCatName}`);

    const emissionDate = new Date().toLocaleString('pt-BR');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Saúde+</title>
  <style>
    :root {
      --primary: #0284c7;
      --primary-light: #e0f2fe;
      --destructive: #ef4444;
      --destructive-light: #fee2e2;
      --amber: #d97706;
      --amber-light: #fef3c7;
      --foreground: #0f172a;
      --muted: #64748b;
      --border: #e2e8f0;
      --card: #ffffff;
      --bg: #f8fafc;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--foreground);
      padding: 24px;
      line-height: 1.5;
    }
    .container { max-width: 1100px; margin: 0 auto; }
    
    .header {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .brand { display: flex; align-items: center; gap: 14px; }
    .logo-badge {
      background: var(--primary);
      color: white;
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 24px;
      box-shadow: 0 4px 10px rgba(2, 132, 199, 0.3);
    }
    .title h1 { font-size: 20px; font-weight: 700; color: var(--foreground); }
    .title p { font-size: 13px; color: var(--muted); margin-top: 2px; }
    .meta { font-size: 12px; color: var(--muted); text-align: right; }
    .meta strong { color: var(--foreground); }
    .filter-tags-wrap { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .filter-tag {
      background: var(--primary-light);
      color: var(--primary);
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .kpi-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 18px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .kpi-value { font-size: 24px; font-weight: 800; }
    .kpi-label { font-size: 12px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-top: 2px; }
    .text-primary { color: var(--primary); }
    .text-destructive { color: var(--destructive); }
    .text-amber { color: var(--amber); }

    .table-container {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 16px;
      overflow-x: auto;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .data-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; min-width: 700px; }
    .data-table th {
      background: #f1f5f9;
      color: #475569;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 700;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border);
    }
    .data-table td {
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
    }
    .data-table tr:last-child td { border-bottom: none; }
    .data-table tr:hover td { background: #f8fafc; }

    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-family: monospace;
      font-weight: 700;
      font-size: 12px;
    }
    .badge-primary { background: var(--primary-light); color: var(--primary); }
    .badge-destructive { background: var(--destructive-light); color: var(--destructive); }
    .badge-amber { background: var(--amber-light); color: var(--amber); }
    .badge-neutral { background: #f1f5f9; color: #475569; }

    .actions-bar {
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      gap: 12px;
      background: white;
      padding: 10px 16px;
      border-radius: 50px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.2);
      border: 1px solid var(--border);
      z-index: 100;
    }
    .btn {
      background: var(--primary);
      color: white;
      border: none;
      padding: 8px 18px;
      border-radius: 25px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: opacity 0.2s;
    }
    .btn:hover { opacity: 0.9; }
    .btn-secondary { background: #f1f5f9; color: #334155; }

    @media print {
      body { background: white; padding: 0; }
      .container { max-width: 100%; }
      .header { border: none; box-shadow: none; padding: 0 0 16px 0; border-bottom: 2px solid var(--border); border-radius: 0; margin-bottom: 16px; }
      .actions-bar { display: none !important; }
      .kpi-card, .table-container { box-shadow: none; border-color: #cbd5e1; }
      th { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .badge { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      tr { page-break-inside: avoid; }
    }

    @media (max-width: 640px) {
      body { padding: 12px; }
      .header { padding: 16px; }
      .meta { text-align: left; }
      .kpi-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
      .kpi-card { padding: 12px; }
      .kpi-value { font-size: 18px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">
        <div class="logo-badge">+</div>
        <div class="title">
          <h1>${title}</h1>
          <p>${subtitle}</p>
          ${filterTags.length > 0 ? `
            <div class="filter-tags-wrap">
              ${filterTags.map(t => `<span class="filter-tag">${t}</span>`).join('')}
            </div>
          ` : ''}
        </div>
      </div>
      <div class="meta">
        <p><strong>Saúde+</strong> • Gestão de Escalas</p>
        <p>Emitido em: ${emissionDate}</p>
        <p>Total de profissionais: <strong>${rows.length}</strong></p>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-value text-primary">+${fmtCredit(totalShifts)}</div>
        <div class="kpi-label">Plantões Extras</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value text-amber">${totalManual > 0 ? '+' : ''}${fmtCredit(totalManual)}</div>
        <div class="kpi-label">Créditos Manuais</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value text-destructive">-${fmtCredit(totalUsed)}</div>
        <div class="kpi-label">Folgas Usadas</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${totalBalance > 0 ? '+' : ''}${fmtCredit(totalBalance)}</div>
        <div class="kpi-label">Saldo Total</div>
      </div>
    </div>

    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Profissional</th>
            <th>Categoria</th>
            <th>Unidade</th>
            <th style="text-align: center;">Plantões</th>
            <th style="text-align: center;">Manuais</th>
            <th style="text-align: center;">Folgas Usadas</th>
            <th style="text-align: center;">Saldo Atual</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td style="font-weight: 600;">${r.employee.name}</td>
              <td>${r.categoryName}</td>
              <td>${r.unitName}</td>
              <td style="text-align: center;">
                <span class="badge badge-primary">+${fmtCredit(r.shifts)}</span>
              </td>
              <td style="text-align: center;">
                ${r.manual !== 0 ? `<span class="badge badge-amber">${r.manual > 0 ? '+' : ''}${fmtCredit(r.manual)}</span>` : '<span style="color: #94a3b8;">—</span>'}
              </td>
              <td style="text-align: center;">
                <span class="badge badge-destructive">-${fmtCredit(r.used)}</span>
              </td>
              <td style="text-align: center;">
                <span class="badge ${r.balance > 0 ? 'badge-primary' : r.balance < 0 ? 'badge-destructive' : 'badge-neutral'}">
                  ${r.balance > 0 ? '+' : ''}${fmtCredit(r.balance)}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <div class="actions-bar">
    <button class="btn" onclick="window.print()">
      🖨️ Imprimir / Salvar PDF
    </button>
    <button class="btn btn-secondary" onclick="window.close()">
      ✕ Fechar
    </button>
  </div>
</body>
</html>`;
  };

  // 1. Abrir Visualização & Impressão (abre popup estilizado e responsivo)
  const handlePrintPreview = () => {
    setLoading(true);
    try {
      const html = buildHtmlReport();
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
      toast.error('Erro ao gerar relatório: ' + (err.message || 'tente novamente'));
    } finally {
      setLoading(false);
    }
  };

  // 2. Baixar Arquivo HTML (autocontido, funciona offline no celular e no computador)
  const handleDownloadHtml = () => {
    setLoading(true);
    try {
      const html = buildHtmlReport();
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = `relatorio-saldo-geral-${new Date().toISOString().slice(0, 10)}.html`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Arquivo HTML gerado com sucesso!');
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Erro ao baixar arquivo HTML: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  // 3. Baixar Planilha CSV (compatível com Excel / Sheets)
  const handleDownloadCsv = () => {
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
      toast.success('Planilha CSV baixada com sucesso!');
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
          <DialogTitle className="flex items-center gap-2">
            <Download size={20} className="text-primary" />
            Exportar Relatório Geral
          </DialogTitle>
          <DialogDescription>
            Exporte o panorama geral de saldos com o mesmo padrão visual do sistema, compatível com celular e PC.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Card Resumo */}
          <div className="p-3.5 rounded-xl border border-border bg-card space-y-2">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <Wallet size={16} className="text-primary" />
              <span>Panorama Geral de Saldos</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Inclui totais de plantões extras, créditos manuais, folgas usadas e saldo final dos profissionais filtrados.
            </p>
            <div className="pt-2 border-t border-border flex flex-col gap-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Profissionais:</span>
                <strong className="text-foreground">{rows.length}</strong>
              </div>
              {filterUnitName && (
                <div className="flex justify-between">
                  <span>Unidade:</span>
                  <strong className="text-foreground">{filterUnitName}</strong>
                </div>
              )}
              {filterCatName && (
                <div className="flex justify-between">
                  <span>Categoria:</span>
                  <strong className="text-foreground">{filterCatName}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="space-y-2 pt-1">
            <Button
              className="w-full gap-2 font-semibold shadow-md"
              onClick={handlePrintPreview}
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
              Visualizar & Imprimir / Salvar em PDF
            </Button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="gap-2 text-xs"
                onClick={handleDownloadHtml}
                disabled={loading}
              >
                <FileText size={14} className="text-primary" />
                Baixar HTML
              </Button>

              <Button
                variant="outline"
                className="gap-2 text-xs"
                onClick={handleDownloadCsv}
                disabled={loading}
              >
                <Download size={14} className="text-amber-600 dark:text-amber-400" />
                Baixar Planilha (Excel)
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
