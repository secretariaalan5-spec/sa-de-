import { useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { FileText, Download, Printer, Loader2, Sparkles, CalendarDays, TrendingDown, Wallet, Calendar } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface Employee {
  id: string;
  name: string;
  category_id: string | null;
  unit_id: string | null;
}

interface Category { id: string; name: string; }
interface Unit { id: string; name: string; }

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
  teamId: string;
  categories: Category[];
  units: Unit[];
  rows: BalanceRow[];
  filterUnitName?: string;
  filterCatName?: string;
}

interface DetailedEntry {
  date: string;
  employeeName: string;
  categoryName: string;
  unitName: string;
  type: string;
  shift: string;
  credit: number;
  observations: string;
}

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const fmtCredit = (n: number) => (n % 1 === 0 ? n.toString() : n.toFixed(1).replace('.', ','));
const fmtDate = (d: string) => {
  if (!d || d === '—') return '—';
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
  } catch {
    return d;
  }
};

export default function ReportExportDialog({
  open,
  onOpenChange,
  teamId,
  categories,
  units,
  rows,
  filterUnitName,
  filterCatName,
}: Props) {
  const [reportType, setReportType] = useState<'general' | 'detailed'>('general');
  const [periodType, setPeriodType] = useState<'all' | 'current_month' | 'custom_month'>('all');

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [detailedKindFilter, setDetailedKindFilter] = useState<'all' | 'schedules' | 'leaves' | 'manual'>('all');

  const [loading, setLoading] = useState(false);

  const catMap = useMemo(() => Object.fromEntries(categories.map(c => [c.id, c.name])), [categories]);
  const unitMap = useMemo(() => Object.fromEntries(units.map(u => [u.id, u.name])), [units]);
  const empMap = useMemo(() => Object.fromEntries(rows.map(r => [r.employee.id, r.employee])), [rows]);

  // Busca dados detalhados quando for relatório detalhado
  const fetchDetailedData = async (): Promise<DetailedEntry[]> => {
    const visibleEmpIds = new Set(rows.map(r => r.employee.id));
    if (visibleEmpIds.size === 0) return [];

    let monthPrefix: string | null = null;
    if (periodType === 'current_month') {
      monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    } else if (periodType === 'custom_month') {
      monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    }

    const [schRes, lvRes, credRes] = await Promise.all([
      supabase
        .from('schedules')
        .select('id, employee_id, date, type, unit_id, shift_type, credit_amount, observations')
        .eq('team_id', teamId),
      supabase
        .from('leave_requests')
        .select('id, employee_id, leave_dates, observations, status')
        .eq('team_id', teamId)
        .eq('status', 'approved'),
      supabase
        .from('leave_credits')
        .select('id, employee_id, amount, origin, notes, created_at')
        .eq('team_id', teamId),
    ]);

    const entries: DetailedEntry[] = [];

    // 1. Escalas e Plantões
    if (detailedKindFilter === 'all' || detailedKindFilter === 'schedules') {
      (schRes.data ?? []).forEach(s => {
        if (!visibleEmpIds.has(s.employee_id)) return;
        if (monthPrefix && !s.date.startsWith(monthPrefix)) return;

        const emp = empMap[s.employee_id];
        const assignedUnit = s.unit_id ? unitMap[s.unit_id] : (emp?.unit_id ? unitMap[emp.unit_id] : '—');
        const creditVal = s.credit_amount != null ? Number(s.credit_amount) : (s.type === 'extra' ? 1 : 0);

        entries.push({
          date: s.date,
          employeeName: emp?.name ?? '—',
          categoryName: emp?.category_id ? catMap[emp.category_id] ?? '—' : '—',
          unitName: assignedUnit,
          type: s.type === 'extra' ? 'Plantão Extra' : 'Escala Normal',
          shift: s.shift_type === 'half' ? 'Meio Turno' : 'Integral',
          credit: creditVal,
          observations: s.observations?.trim() || 'Plantão escalado',
        });
      });
    }

    // 2. Folgas Usufruídas
    if (detailedKindFilter === 'all' || detailedKindFilter === 'leaves') {
      (lvRes.data ?? []).forEach(l => {
        if (!visibleEmpIds.has(l.employee_id)) return;
        const emp = empMap[l.employee_id];
        const dates = (l.leave_dates ?? []).filter(d => !monthPrefix || d.startsWith(monthPrefix));

        dates.forEach(d => {
          entries.push({
            date: d,
            employeeName: emp?.name ?? '—',
            categoryName: emp?.category_id ? catMap[emp.category_id] ?? '—' : '—',
            unitName: emp?.unit_id ? unitMap[emp.unit_id] ?? '—' : '—',
            type: 'Folga Usufruída',
            shift: '—',
            credit: -1,
            observations: l.observations?.trim() || 'Folga aprovada',
          });
        });
      });
    }

    // 3. Créditos Manuais / Ajustes
    if (detailedKindFilter === 'all' || detailedKindFilter === 'manual') {
      (credRes.data ?? []).forEach(c => {
        if (!visibleEmpIds.has(c.employee_id)) return;
        if (c.origin === 'extra_shift' || c.origin === 'leave_used') return;

        const dateStr = c.created_at ? c.created_at.slice(0, 10) : '—';
        if (monthPrefix && dateStr !== '—' && !dateStr.startsWith(monthPrefix)) return;

        const emp = empMap[c.employee_id];
        entries.push({
          date: dateStr,
          employeeName: emp?.name ?? '—',
          categoryName: emp?.category_id ? catMap[emp.category_id] ?? '—' : '—',
          unitName: emp?.unit_id ? unitMap[emp.unit_id] ?? '—' : '—',
          type: c.origin === 'initial_balance' ? 'Saldo Inicial' : 'Ajuste Manual',
          shift: '—',
          credit: Number(c.amount),
          observations: c.notes?.trim() || (c.origin === 'initial_balance' ? 'Lançamento de saldo inicial' : 'Ajuste de crédito'),
        });
      });
    }

    // Ordenar cronologicamente por data decrescente e depois por nome
    entries.sort((a, b) => b.date.localeCompare(a.date) || a.employeeName.localeCompare(b.employeeName));
    return entries;
  };

  // Constrói o HTML estilizado, moderno e responsivo
  const buildHtmlReport = async (): Promise<string> => {
    const isDetailed = reportType === 'detailed';
    const detailedData = isDetailed ? await fetchDetailedData() : [];

    const totalShifts = rows.reduce((s, r) => s + r.shifts, 0);
    const totalManual = rows.reduce((s, r) => s + r.manual, 0);
    const totalUsed = rows.reduce((s, r) => s + r.used, 0);
    const totalBalance = rows.reduce((s, r) => s + r.balance, 0);

    const title = isDetailed ? 'Relatório Detalhado de Escalas e Folgas' : 'Relatório de Saldo de Folgas';
    const subtitle = isDetailed
      ? 'Detalhamento dia a dia de escalas, unidades de atuação, folgas e ajustes manuais'
      : 'Panorama geral de plantões extras, ajustes manuais, folgas usadas e saldo final';

    let periodLabel = 'Todo o histórico';
    if (periodType === 'current_month') periodLabel = `${MONTHS[now.getMonth()]} de ${now.getFullYear()}`;
    if (periodType === 'custom_month') periodLabel = `${MONTHS[selectedMonth]} de ${selectedYear}`;

    const filterTags: string[] = [];
    if (filterUnitName) filterTags.push(`Unidade: ${filterUnitName}`);
    if (filterCatName) filterTags.push(`Categoria: ${filterCatName}`);
    filterTags.push(`Período: ${periodLabel}`);
    if (isDetailed && detailedKindFilter !== 'all') {
      const kindNames = { schedules: 'Apenas Escalas/Plantões', leaves: 'Apenas Folgas', manual: 'Apenas Ajustes Manuais' };
      filterTags.push(`Filtro: ${kindNames[detailedKindFilter]}`);
    }

    const emissionDate = new Date().toLocaleString('pt-BR');

    let tableHtml = '';

    if (!isDetailed) {
      tableHtml = `
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
      `;
    } else {
      if (detailedData.length === 0) {
        tableHtml = `
          <div style="text-align: center; padding: 40px; color: #64748b;">
            <p style="font-weight: 600; font-size: 15px;">Nenhum registro encontrado para os filtros selecionados.</p>
          </div>
        `;
      } else {
        tableHtml = `
          <table class="data-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Profissional</th>
                <th>Categoria</th>
                <th>Unidade</th>
                <th>Tipo</th>
                <th>Turno</th>
                <th style="text-align: center;">Crédito</th>
                <th>Observações / Atividade</th>
              </tr>
            </thead>
            <tbody>
              ${detailedData.map(d => {
                const isPositive = d.credit > 0;
                const isNegative = d.credit < 0;
                const badgeClass = isPositive ? 'badge-primary' : isNegative ? 'badge-destructive' : 'badge-neutral';
                return `
                  <tr>
                    <td style="white-space: nowrap; font-weight: 600;">${fmtDate(d.date)}</td>
                    <td style="font-weight: 500;">${d.employeeName}</td>
                    <td>${d.categoryName}</td>
                    <td>${d.unitName}</td>
                    <td>
                      <span class="type-pill ${d.type.includes('Plantão') ? 'type-shift' : d.type.includes('Folga') ? 'type-leave' : 'type-manual'}">
                        ${d.type}
                      </span>
                    </td>
                    <td>${d.shift}</td>
                    <td style="text-align: center;">
                      ${d.credit !== 0 ? `<span class="badge ${badgeClass}">${isPositive ? '+' : ''}${fmtCredit(d.credit)}</span>` : '<span style="color: #94a3b8;">—</span>'}
                    </td>
                    <td style="max-width: 280px; word-break: break-word;">${d.observations}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `;
      }
    }

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

    .type-pill {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      display: inline-block;
    }
    .type-shift { background: #e0f2fe; color: #0284c7; }
    .type-leave { background: #fee2e2; color: #dc2626; }
    .type-manual { background: #fef3c7; color: #d97706; }

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
      .badge, .type-pill { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
          <div class="filter-tags-wrap">
            ${filterTags.map(t => `<span class="filter-tag">${t}</span>`).join('')}
          </div>
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
      ${tableHtml}
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
  const handlePrintPreview = async () => {
    setLoading(true);
    try {
      const html = await buildHtmlReport();
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
  const handleDownloadHtml = async () => {
    setLoading(true);
    try {
      const html = await buildHtmlReport();
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = `relatorio-saldo-${reportType === 'detailed' ? 'detalhado' : 'geral'}-${new Date().toISOString().slice(0, 10)}.html`;
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
  const handleDownloadCsv = async () => {
    setLoading(true);
    try {
      let csvContent = '\uFEFF'; // UTF-8 BOM
      if (reportType === 'general') {
        csvContent += 'Profissional;Categoria;Unidade;Plantões Extras;Créditos Manuais;Folgas Usadas;Saldo Atual\n';
        rows.forEach(r => {
          csvContent += `"${r.employee.name}";"${r.categoryName}";"${r.unitName}";"${fmtCredit(r.shifts)}";"${fmtCredit(r.manual)}";"${fmtCredit(r.used)}";"${fmtCredit(r.balance)}"\n`;
        });
      } else {
        const detailed = await fetchDetailedData();
        csvContent += 'Data;Profissional;Categoria;Unidade;Tipo;Turno;Crédito;Observações / O que fez\n';
        detailed.forEach(d => {
          csvContent += `"${fmtDate(d.date)}";"${d.employeeName}";"${d.categoryName}";"${d.unitName}";"${d.type}";"${d.shift}";"${fmtCredit(d.credit)}";"${(d.observations || '').replace(/"/g, '""')}"\n`;
        });
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = `relatorio-${reportType === 'detailed' ? 'detalhado' : 'saldos'}-${new Date().toISOString().slice(0, 10)}.csv`;
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download size={20} className="text-primary" />
            Exportar Relatório
          </DialogTitle>
          <DialogDescription>
            Escolha o formato e o tipo de dados para gerar um arquivo responsivo com o mesmo design visual da página.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Tipo de Relatório */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Tipo de Relatório</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setReportType('general')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  reportType === 'general'
                    ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                    : 'border-border bg-card hover:bg-muted/50 text-foreground'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Wallet size={16} />
                  <span className="text-sm">Panorama Geral</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-normal leading-tight">
                  Saldo total, plantões extras, manuais e folgas por profissional
                </p>
              </button>

              <button
                type="button"
                onClick={() => setReportType('detailed')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  reportType === 'detailed'
                    ? 'border-primary bg-primary/10 text-primary font-bold shadow-sm'
                    : 'border-border bg-card hover:bg-muted/50 text-foreground'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <CalendarDays size={16} />
                  <span className="text-sm">Detalhado por Dia</span>
                </div>
                <p className="text-[11px] text-muted-foreground font-normal leading-tight">
                  Dias exatos, para onde foi escalado, o que fez e motivos de folgas
                </p>
              </button>
            </div>
          </div>

          {/* Filtro de Período (especialmente útil no detalhado) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Calendar size={14} className="text-primary" />
              Período de Referência
            </Label>
            <Select value={periodType} onValueChange={v => setPeriodType(v as any)}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo o Histórico</SelectItem>
                <SelectItem value="current_month">Mês Atual ({MONTHS[now.getMonth()]})</SelectItem>
                <SelectItem value="custom_month">Mês Específico...</SelectItem>
              </SelectContent>
            </Select>

            {periodType === 'custom_month' && (
              <div className="grid grid-cols-2 gap-2 pt-1 animate-fade-in">
                <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Filtro de Tipo de Lançamento (quando for detalhado) */}
          {reportType === 'detailed' && (
            <div className="space-y-1.5 animate-fade-in">
              <Label className="text-xs font-semibold">Filtrar Lançamentos do Dia a Dia</Label>
              <Select value={detailedKindFilter} onValueChange={v => setDetailedKindFilter(v as any)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Lançamentos (Escalas + Folgas + Manuais)</SelectItem>
                  <SelectItem value="schedules">Apenas Dias Escalados (onde foi, o que fez)</SelectItem>
                  <SelectItem value="leaves">Apenas Folgas Gozadas (datas e observações)</SelectItem>
                  <SelectItem value="manual">Apenas Ajustes Manuais de Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Resumo do filtro atual */}
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>Profissionais inclusos:</span>
              <strong className="text-foreground">{rows.length} profissional(is)</strong>
            </div>
            {filterUnitName && (
              <div className="flex justify-between">
                <span>Unidade filtrada:</span>
                <strong className="text-foreground">{filterUnitName}</strong>
              </div>
            )}
            {filterCatName && (
              <div className="flex justify-between">
                <span>Categoria filtrada:</span>
                <strong className="text-foreground">{filterCatName}</strong>
              </div>
            )}
          </div>

          {/* Botões de Ação */}
          <div className="space-y-2 pt-2">
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
                Baixar Arquivo HTML
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
