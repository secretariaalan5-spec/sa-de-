import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Printer, Loader2, FileSpreadsheet } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/untyped-client';

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

const fmtDate = (d: string) => {
  if (!d) return '—';
  try {
    return new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('pt-BR');
  } catch {
    return d;
  }
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Movimentação de um profissional (escala, folga ou crédito manual) */
interface Entry {
  kind: 'escala' | 'extra' | 'folga' | 'manual';
  date: string; // YYYY-MM-DD
  label: string;
  desc: string;
}

/** Busca paginada sem limite de 1000 linhas */
async function fetchAll(build: () => any): Promise<any[]> {
  const all: any[] = [];
  let from = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await build().range(from, from + 999);
    if (error || !data) break;
    all.push(...data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
}

/** Carrega escalas, folgas aprovadas e créditos manuais e monta a linha do tempo de cada profissional */
async function loadEntries(employeeIds: string[]): Promise<Record<string, Entry[]>> {
  const result: Record<string, Entry[]> = {};
  employeeIds.forEach(id => (result[id] = []));

  const unitRes = await supabase.from('units').select('id, name');
  const unitName: Record<string, string> = Object.fromEntries(
    (unitRes.data ?? []).map((u: any) => [u.id, u.name])
  );

  for (let i = 0; i < employeeIds.length; i += 40) {
    const ids = employeeIds.slice(i, i + 40);

    const [schedules, leaves, credits] = await Promise.all([
      fetchAll(() =>
        supabase
          .from('schedules')
          .select('id, employee_id, date, type, unit_id, shift_type, credit_amount, observations')
          .in('employee_id', ids)
          .order('date')
      ),
      fetchAll(() =>
        supabase
          .from('leave_requests')
          .select('id, employee_id, leave_dates, observations, status')
          .in('employee_id', ids)
          .eq('status', 'approved')
      ),
      fetchAll(() =>
        supabase
          .from('leave_credits')
          .select('id, employee_id, amount, origin, reference_id, notes, created_at')
          .in('employee_id', ids)
          .order('created_at')
      ),
    ]);

    schedules.forEach((s: any) => {
      let label = 'Escala';
      if (s.type === 'extra') {
        let amount = s.credit_amount != null && Number(s.credit_amount) > 0 ? Number(s.credit_amount) : 0;
        if (!amount) {
          const linked = credits.find((c: any) => c.reference_id === s.id && c.origin === 'extra_shift');
          amount = linked ? Number(linked.amount) : s.shift_type === 'half' ? 0.5 : 1;
        }
        label = `Plantão extra (+${fmtCredit(amount)})`;
      }
      const unit = s.unit_id ? unitName[s.unit_id] : '';
      const base = s.observations?.trim() || 'Plantão na unidade';
      result[s.employee_id]?.push({
        kind: s.type === 'extra' ? 'extra' : 'escala',
        date: s.date,
        label,
        desc: unit ? `${base} — ${unit}` : base,
      });
    });

    leaves.forEach((l: any) => {
      (l.leave_dates ?? []).forEach((d: string) => {
        result[l.employee_id]?.push({
          kind: 'folga',
          date: d,
          label: 'Folga',
          desc: l.observations?.trim() || 'Motivo não informado',
        });
      });
    });

    credits.forEach((c: any) => {
      if (c.origin === 'extra_shift' || c.origin === 'leave_used') return;
      const amount = Number(c.amount);
      const add = amount > 0;
      result[c.employee_id]?.push({
        kind: 'manual',
        date: String(c.created_at).slice(0, 10),
        label: add ? `Crédito manual (+${fmtCredit(amount)})` : `Crédito retirado (-${fmtCredit(Math.abs(amount))})`,
        desc: c.notes?.trim() || (c.origin === 'initial_balance' ? 'Saldo inicial' : 'Ajuste manual'),
      });
    });
  }

  Object.values(result).forEach(list => list.sort((a, b) => a.date.localeCompare(b.date)));
  return result;
}

export default function ReportExportDialog({
  open,
  onOpenChange,
  rows,
  filterUnitName,
  filterCatName,
}: Props) {
  const [loading, setLoading] = useState(false);

  // Gera layout limpo, tradicional e institucional para impressão e PDF
  const buildPrintHtml = (entries: Record<string, Entry[]>): string => {
    const totalShifts = rows.reduce((s, r) => s + r.shifts, 0);
    const totalManual = rows.reduce((s, r) => s + r.manual, 0);
    const totalUsed = rows.reduce((s, r) => s + r.used, 0);
    const totalBalance = rows.reduce((s, r) => s + r.balance, 0);

    const emissionDate = new Date().toLocaleString('pt-BR');

    // Agrupar profissionais por Unidade de Saúde
    const unitMap = new Map<string, BalanceRow[]>();
    rows.forEach(r => {
      const uName = r.unitName || 'Sem Unidade';
      if (!unitMap.has(uName)) unitMap.set(uName, []);
      unitMap.get(uName)!.push(r);
    });

    const sortedUnits = Array.from(unitMap.keys()).sort((a, b) => {
      if (a === 'Sem Unidade') return 1;
      if (b === 'Sem Unidade') return -1;
      return a.localeCompare(b);
    });

    const unitSections = sortedUnits.map(unitName => {
      // Ordenar por categoria primeiro, depois por nome do profissional
      const unitRows = [...unitMap.get(unitName)!].sort((a, b) => {
        const catA = a.categoryName || 'Sem Categoria';
        const catB = b.categoryName || 'Sem Categoria';
        if (catA === 'Sem Categoria' && catB !== 'Sem Categoria') return 1;
        if (catB === 'Sem Categoria' && catA !== 'Sem Categoria') return -1;
        const cmpCat = catA.localeCompare(catB);
        if (cmpCat !== 0) return cmpCat;
        return a.employee.name.localeCompare(b.employee.name);
      });
      const uShifts = unitRows.reduce((s, r) => s + r.shifts, 0);
      const uManual = unitRows.reduce((s, r) => s + r.manual, 0);
      const uUsed = unitRows.reduce((s, r) => s + r.used, 0);
      const uBalance = unitRows.reduce((s, r) => s + r.balance, 0);

      return {
        unitName,
        rows: unitRows,
        totalShifts: uShifts,
        totalManual: uManual,
        totalUsed: uUsed,
        totalBalance: uBalance,
      };
    });

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório de Saldo de Folgas por Unidade e Categoria — Saúde+</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #111827;
      background: #ffffff;
      padding: 24px;
      font-size: 11.5px;
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
      font-weight: 700;
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
      margin-bottom: 20px;
    }
    .summary-item {
      border: 1px solid #d1d5db;
      border-radius: 4px;
      padding: 8px 12px;
      text-align: center;
      background: #f9fafb;
    }
    .summary-item .label {
      font-size: 10px;
      text-transform: uppercase;
      color: #6b7280;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .summary-item .value {
      font-size: 16px;
      font-weight: bold;
      margin-top: 3px;
      color: #111827;
    }

    .unit-block {
      margin-bottom: 24px;
      page-break-inside: auto;
    }
    .unit-header {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-bottom: 2px solid #334155;
      padding: 8px 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top-left-radius: 4px;
      border-top-right-radius: 4px;
    }
    .unit-title {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .unit-count {
      font-size: 11px;
      font-weight: normal;
      color: #475569;
      background: #e2e8f0;
      padding: 2px 6px;
      border-radius: 3px;
    }
    .unit-stats {
      font-size: 11px;
      color: #334155;
      display: flex;
      gap: 12px;
    }
    .unit-stats strong {
      font-family: monospace;
      font-size: 11.5px;
    }

    /* FORMATO DE GRADE TABULAR */
    .grid-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #cbd5e1;
      border-top: none;
      background: #ffffff;
      font-size: 11px;
    }
    .grid-table thead th {
      background: #f8fafc;
      color: #334155;
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 7px 10px;
      border: 1px solid #cbd5e1;
      text-align: left;
    }
    .grid-table tbody tr {
      border-bottom: 1px solid #e2e8f0;
      page-break-inside: avoid;
    }
    .grid-table tbody tr:nth-child(even) {
      background: #fbfcfd;
    }
    .grid-table td {
      border: 1px solid #e2e8f0;
      padding: 7px 9px;
      vertical-align: top;
      line-height: 1.35;
    }
    .cell-prof {
      vertical-align: top;
    }
    .p-name {
      font-size: 11.5px;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.3;
    }
    .p-cat {
      display: inline-block;
      margin-top: 3px;
      font-size: 9.5px;
      color: #475569;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 1px 5px;
      border-radius: 3px;
      font-weight: 500;
    }
    .col-pill {
      display: inline-block;
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      padding: 1px 5px;
      border-radius: 3px;
      margin-bottom: 4px;
    }
    .col-pill-shift {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
    }
    .col-pill-leave {
      background: #fef2f2;
      color: #b91c1c;
      border: 1px solid #fecaca;
    }
    .ev-stack {
      display: flex;
      flex-direction: column;
      gap: 2.5px;
    }
    .ln {
      font-size: 10px;
      line-height: 1.35;
      padding: 1px 0;
      border-bottom: 1px dotted #f1f5f9;
      color: #334155;
    }
    .ln:last-child {
      border-bottom: none;
    }
    .ln .dt {
      font-weight: 700;
      color: #0f172a;
      margin-right: 4px;
      white-space: nowrap;
    }
    .ln .dt i {
      font-style: normal;
      font-weight: 400;
      color: #64748b;
    }
    .tag {
      font-size: 9px;
      font-weight: 700;
      padding: 0 4px;
      border-radius: 2px;
      margin-right: 4px;
      white-space: nowrap;
    }
    .tag.extra { background: #dbeafe; color: #1e40af; }
    .tag.add { background: #fef3c7; color: #92400e; }
    .tag.rem { background: #f3e8ff; color: #6b21a8; }
    .dash-empty {
      color: #94a3b8;
      font-weight: bold;
      font-size: 12px;
      display: inline-block;
      padding: 2px 0;
    }
    .cell-bal {
      text-align: center;
      vertical-align: middle !important;
      white-space: nowrap;
    }
    .bal-pill {
      display: inline-block;
      font-size: 13px;
      font-weight: 800;
      font-family: monospace;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid transparent;
    }
    .bal-pill.pos {
      background: #ecfdf5;
      color: #047857;
      border-color: #a7f3d0;
    }
    .bal-pill.neg {
      background: #fef2f2;
      color: #b91c1c;
      border-color: #fecaca;
    }
    .bal-pill.zero {
      background: #f8fafc;
      color: #64748b;
      border-color: #e2e8f0;
    }
    .bal-meta {
      margin-top: 4px;
      font-size: 9px;
      color: #64748b;
      line-height: 1.25;
    }
    .bal-meta b {
      font-family: monospace;
      color: #334155;
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
      font-weight: 600;
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
      .unit-header { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .unit-block { page-break-inside: auto; }
      .grid-table { page-break-inside: auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .grid-table thead { display: table-header-group; }
      .grid-table tbody tr { page-break-inside: avoid; }
      .grid-table thead th { background: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .grid-table tbody tr:nth-child(even) { background: #fbfcfd !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .bal-pill, .tag, .col-pill, .p-cat { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
      <p>Secretaria de Saúde • Grade Detalhada por Unidade e Categoria Profissional</p>
    </div>
    <div class="header-meta">
      <p>Data de emissão: <strong>${emissionDate}</strong></p>
      <p>Total de profissionais: <strong>${rows.length}</strong> em <strong>${unitSections.length} unidades</strong></p>
    </div>
  </div>

  <div class="filters-box">
    <div>Filtro de Unidade: <strong>${filterUnitName || 'Todas as Unidades'}</strong></div>
    <div>Filtro de Categoria: <strong>${filterCatName || 'Todas as Categorias'}</strong></div>
  </div>

  <div class="summary-grid">
    <div class="summary-item">
      <div class="label">Créditos de Plantões</div>
      <div class="value">+${fmtCredit(totalShifts)}</div>
    </div>
    <div class="summary-item">
      <div class="label">Créditos Manuais</div>
      <div class="value">${totalManual > 0 ? '+' : ''}${fmtCredit(totalManual)}</div>
    </div>
    <div class="summary-item">
      <div class="label">Folgas Descontadas</div>
      <div class="value">-${fmtCredit(totalUsed)}</div>
    </div>
    <div class="summary-item">
      <div class="label">Saldo Atual Total</div>
      <div class="value" style="color: #059669;">${totalBalance > 0 ? '+' : ''}${fmtCredit(totalBalance)}</div>
    </div>
  </div>

  ${unitSections.map(unit => `
    <div class="unit-block">
      <div class="unit-header">
        <div class="unit-title">
          <span>${unit.unitName}</span>
          <span class="unit-count">${unit.rows.length} ${unit.rows.length === 1 ? 'profissional' : 'profissionais'}</span>
        </div>
        <div class="unit-stats">
          <span>Saldo da Unidade: <strong style="color: #059669;">${unit.totalBalance > 0 ? '+' : ''}${fmtCredit(unit.totalBalance)}</strong></span>
        </div>
      </div>

      <table class="grid-table">
        <thead>
          <tr>
            <th style="width: 21%;">Profissional / Categoria</th>
            <th style="width: 32%;">Plantões Extras & Escalas Realizadas</th>
            <th style="width: 23%;">Folgas Usufruídas</th>
            <th style="width: 14%;">Ajustes Manuais</th>
            <th style="width: 10%; text-align: center;">Saldo Atual</th>
          </tr>
        </thead>
        <tbody>
          ${unit.rows.map(r => {
            const list = entries[r.employee.id] ?? [];
            const wd = (d: string) => {
              try { return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''); } catch { return ''; }
            };
            const scales = list.filter(e => e.kind === 'escala' || e.kind === 'extra');
            const leaves = list.filter(e => e.kind === 'folga');
            const manuals = list.filter(e => e.kind === 'manual');
            const signed = (n: number) => (n > 0 ? '+' : '') + fmtCredit(n);

            return `
            <tr>
              <td class="cell-prof">
                <div class="p-name">${esc(r.employee.name)}</div>
                <span class="p-cat">${esc(r.categoryName)}</span>
              </td>
              <td class="cell-events">
                ${scales.length === 0 ? '<span class="dash-empty">—</span>' : `
                  <div class="col-pill col-pill-shift">+${fmtCredit(r.shifts)} créditos (${scales.length} ${scales.length === 1 ? 'escala' : 'escalas'})</div>
                  <div class="ev-stack">
                    ${scales.map(e => `
                      <div class="ln">
                        <span class="dt">${fmtDate(e.date).slice(0, 5)} <i>${wd(e.date)}</i></span>
                        ${e.kind === 'extra' ? `<span class="tag extra">${esc(e.label.replace('Plantão extra ', 'Extra '))}</span>` : ''}
                        <span class="tx">${esc(e.desc)}</span>
                      </div>
                    `).join('')}
                  </div>
                `}
              </td>
              <td class="cell-events">
                ${leaves.length === 0 ? '<span class="dash-empty">—</span>' : `
                  <div class="col-pill col-pill-leave">-${fmtCredit(r.used)} ${r.used === 1 ? 'folga' : 'folgas'}</div>
                  <div class="ev-stack">
                    ${leaves.map(e => `
                      <div class="ln">
                        <span class="dt">${fmtDate(e.date).slice(0, 5)} <i>${wd(e.date)}</i></span>
                        <span class="tx">${esc(e.desc)}</span>
                      </div>
                    `).join('')}
                  </div>
                `}
              </td>
              <td class="cell-events">
                ${manuals.length === 0 ? '<span class="dash-empty">—</span>' : `
                  <div class="ev-stack">
                    ${manuals.map(e => {
                      const removed = e.label.startsWith('Crédito retirado');
                      return `
                      <div class="ln">
                        <span class="dt">${fmtDate(e.date).slice(0, 5)}</span>
                        <span class="tag ${removed ? 'rem' : 'add'}">${esc(e.label.replace('Crédito manual', 'Adicionado').replace('Crédito retirado', 'Retirado'))}</span>
                        <span class="tx">${esc(e.desc)}</span>
                      </div>`;
                    }).join('')}
                  </div>
                `}
              </td>
              <td class="cell-bal">
                <div class="bal-pill ${r.balance > 0 ? 'pos' : r.balance < 0 ? 'neg' : 'zero'}">
                  ${signed(r.balance)}
                </div>
                <div class="bal-meta">
                  <div>Pl: <b>+${fmtCredit(r.shifts)}</b></div>
                  ${r.manual !== 0 ? `<div>Aj: <b>${signed(r.manual)}</b></div>` : ''}
                  <div>Fol: <b>-${fmtCredit(r.used)}</b></div>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `).join('')}

  <div class="footer">
    Documento emitido eletronicamente pelo Sistema de Gestão de Escalas da Secretaria de Saúde
  </div>
</body>
</html>`;
  };

  // 1. Abrir visualização direta para PDF / Impressão (inclui escalas, folgas e créditos manuais)
  const handlePrintPdf = async () => {
    // A janela precisa ser aberta no clique, antes de aguardar os dados
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('O navegador bloqueou a abertura da janela. Permita popups para visualizar o relatório.');
      return;
    }
    printWindow.document.write('<p style="font-family:Arial;padding:24px">Gerando relatório...</p>');
    setLoading(true);
    try {
      const entries = await loadEntries(rows.map(r => r.employee.id));
      const html = buildPrintHtml(entries);
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      onOpenChange(false);
    } catch (err: any) {
      printWindow.close();
      toast.error('Erro ao gerar PDF: ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  // 2. Baixar Planilha Excel (CSV compatível com Excel pt-BR agrupado por Unidade e Categoria)
  const handleDownloadExcel = async () => {
    setLoading(true);
    try {
      const entries = await loadEntries(rows.map(r => r.employee.id));
      // Ordenar por Unidade, depois por Categoria, e depois por Nome do Profissional
      const sortedRows = [...rows].sort((a, b) => {
        const uA = a.unitName || 'Sem Unidade';
        const uB = b.unitName || 'Sem Unidade';
        if (uA === 'Sem Unidade' && uB !== 'Sem Unidade') return 1;
        if (uB === 'Sem Unidade' && uA !== 'Sem Unidade') return -1;
        const cmpUnit = uA.localeCompare(uB);
        if (cmpUnit !== 0) return cmpUnit;

        const catA = a.categoryName || 'Sem Categoria';
        const catB = b.categoryName || 'Sem Categoria';
        if (catA === 'Sem Categoria' && catB !== 'Sem Categoria') return 1;
        if (catB === 'Sem Categoria' && catA !== 'Sem Categoria') return -1;
        const cmpCat = catA.localeCompare(catB);
        if (cmpCat !== 0) return cmpCat;

        return a.employee.name.localeCompare(b.employee.name);
      });

      let csvContent = '\uFEFF'; // UTF-8 BOM
      csvContent += 'Unidade de Saúde;Categoria;Profissional;Plantões Extras;Créditos Manuais;Folgas Usadas;Saldo Atual\n';
      sortedRows.forEach(r => {
        csvContent += `"${r.unitName}";"${r.categoryName}";"${r.employee.name}";"${fmtCredit(r.shifts)}";"${fmtCredit(r.manual)}";"${fmtCredit(r.used)}";"${fmtCredit(r.balance)}"\n`;
      });

      // Movimentação detalhada: dias de escala, folgas e créditos manuais de cada profissional
      csvContent += '\nMOVIMENTAÇÃO DETALHADA\n';
      csvContent += 'Unidade de Saúde;Categoria;Profissional;Data;Tipo;Descrição\n';
      sortedRows.forEach(r => {
        (entries[r.employee.id] ?? []).forEach(e => {
          csvContent += `"${r.unitName}";"${r.categoryName}";"${r.employee.name}";"${fmtDate(e.date)}";"${e.label}";"${e.desc.replace(/"/g, '""')}"\n`;
        });
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
      toast.success('Planilha Excel gerada com sucesso e organizada por unidade e categoria!');
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
