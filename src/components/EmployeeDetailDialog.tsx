import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CalendarDays,
  CalendarOff,
  ArrowRightLeft,
  Wallet,
  Loader2,
  Printer,
  FileSpreadsheet,
  Building2,
  KeyRound,
} from 'lucide-react';
import AccessCodeDialog from '@/components/AccessCodeDialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface Props {
  employeeId: string | null;
  employeeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Schedule {
  id: string;
  date: string;
  type: string;
  unit_id: string | null;
  shift_type: string | null;
  credit_amount: number | null;
  observations: string | null;
}

interface LeaveReq {
  id: string;
  status: string;
  days_requested: number;
  leave_dates: string[];
  observations: string | null;
  created_at: string;
  decided_at: string | null;
}

interface Transfer {
  id: string;
  from_unit_id: string | null;
  to_unit_id: string | null;
  transferred_at: string;
}

interface Credit {
  id?: string;
  amount: number;
  origin: string;
  reference_id?: string | null;
  notes?: string | null;
  created_at: string;
}

interface Unit { id: string; name: string; }
interface Category { id: string; name: string; }

const fmtCredit = (n: number) => (n % 1 === 0 ? n.toString() : n.toFixed(1).replace('.', ','));
const fmtDate = (d: string) => {
  if (!d) return '—';
  try {
    return new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('pt-BR');
  } catch {
    return d;
  }
};
const weekday = (d: string) => {
  try {
    return new Date((d.includes('T') ? d : d + 'T12:00:00')).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  } catch {
    return '';
  }
};

export default function EmployeeDetailDialog({ employeeId, employeeName, open, onOpenChange }: Props) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [leaves, setLeaves] = useState<LeaveReq[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [empCategoryName, setEmpCategoryName] = useState<string>('—');
  const [empUnitName, setEmpUnitName] = useState<string>('—');
  const [empPhone, setEmpPhone] = useState<string | null>(null);
  const [empAvatarUrl, setEmpAvatarUrl] = useState<string | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!employeeId || !open) return;
    setLoading(true);

    Promise.all([
      // 1. Escalas completas (com atividade/observação, unidade, turno e valor de crédito)
      supabase
        .from('schedules')
        .select('id, date, type, unit_id, shift_type, credit_amount, observations')
        .eq('employee_id', employeeId)
        .order('date', { ascending: false })
        .limit(200),

      // 2. Pedidos de folga com motivo
      supabase
        .from('leave_requests')
        .select('id, status, days_requested, leave_dates, observations, created_at, decided_at')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false }),

      // 3. Histórico de transferências
      supabase
        .from('transfer_history')
        .select('id, from_unit_id, to_unit_id, transferred_at')
        .eq('employee_id', employeeId)
        .order('transferred_at', { ascending: false }),

      // 4. Extrato de créditos vinculados às escalas e ajustes manuais
      supabase
        .from('leave_credits')
        .select('id, amount, origin, reference_id, notes, created_at')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false }),

      // 5. Unidades e Categorias
      supabase.from('units').select('id, name'),
      supabase.from('categories').select('id, name'),

      // 6. Dados do próprio profissional (categoria, unidade, telefone e foto avatar_url)
      supabase.from('employees').select('id, category_id, unit_id, phone, avatar_url').eq('id', employeeId).maybeSingle(),
    ]).then(([s, l, t, c, u, cat, emp]) => {
      setSchedules(s.data ?? []);
      setLeaves(l.data ?? []);
      setTransfers(t.data ?? []);
      setCredits(c.data ?? []);

      const uList = u.data ?? [];
      const catList = cat.data ?? [];
      setUnits(uList);
      setCategories(catList);

      if (emp.data) {
        const catObj = catList.find(x => x.id === emp.data.category_id);
        const unitObj = uList.find(x => x.id === emp.data.unit_id);
        setEmpCategoryName(catObj?.name ?? '—');
        setEmpUnitName(unitObj?.name ?? '—');
        setEmpPhone(emp.data.phone ?? null);
        setEmpAvatarUrl(emp.data.avatar_url ?? null);
      }

      setLoading(false);
    });
  }, [employeeId, open]);

  const getUnitName = (id: string | null) => (id ? units.find(u => u.id === id)?.name ?? '—' : empUnitName);

  // Calcula a quantidade exata de créditos ganhos para uma escala específica
  const getScheduleCredits = (s: Schedule): number => {
    if (s.type !== 'extra') return 0;
    if (s.credit_amount != null && Number(s.credit_amount) > 0) {
      return Number(s.credit_amount);
    }
    const linked = credits.find(c => c.reference_id === s.id && c.origin === 'extra_shift');
    if (linked && Number(linked.amount) > 0) {
      return Number(linked.amount);
    }
    return s.shift_type === 'half' ? 0.5 : 1;
  };

  // Totais de créditos
  const totalShifts = credits.filter(c => c.origin === 'extra_shift').reduce((s, c) => s + Number(c.amount), 0);
  const totalManual = credits
    .filter(c => c.origin !== 'extra_shift' && c.origin !== 'leave_used')
    .reduce((s, c) => s + Number(c.amount), 0);
  const totalUsed = Math.abs(
    credits.filter(c => c.origin === 'leave_used').reduce((s, c) => s + Number(c.amount), 0)
  );
  const balance = credits.reduce((s, c) => s + Number(c.amount), 0);

  const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
    pending: { label: 'Pendente', variant: 'secondary' },
    approved: { label: 'Aprovado', variant: 'default' },
    rejected: { label: 'Negado', variant: 'destructive' },
  };

  // Constrói relatório funcional individual no mesmo formato institucional de grade da aba Relatórios
  const buildIndividualPrintHtml = (): string => {
    const emissionDate = new Date().toLocaleString('pt-BR');
    const esc = (s?: string | null) =>
      (s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const manualCredits = credits.filter(c => c.origin !== 'extra_shift' && c.origin !== 'leave_used');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório Individual — ${esc(employeeName)} — Saúde+</title>
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
    .info-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 10px 14px;
      margin-bottom: 16px;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      font-size: 11px;
    }
    .info-cell .info-label {
      font-size: 9.5px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 600;
      display: block;
      margin-bottom: 2px;
    }
    .info-cell .info-val {
      font-size: 12px;
      font-weight: 700;
      color: #0f172a;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin-bottom: 20px;
    }
    .summary-item {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 8px 12px;
      text-align: center;
      background: #f8fafc;
    }
    .summary-item .label {
      font-size: 10px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .summary-item .value {
      font-size: 16px;
      font-weight: bold;
      margin-top: 3px;
      color: #0f172a;
      font-family: monospace;
    }

    .unit-block {
      margin-bottom: 22px;
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
      font-size: 12.5px;
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
      padding: 7px 10px;
      vertical-align: top;
      line-height: 1.35;
    }
    .tag {
      font-size: 9px;
      font-weight: 700;
      padding: 1px 5px;
      border-radius: 2px;
      margin-right: 4px;
      white-space: nowrap;
      display: inline-block;
    }
    .tag.extra { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
    .tag.normal { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
    .tag.add { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .tag.rem { background: #f3e8ff; color: #6b21a8; border: 1px solid #e9d5ff; }
    .tag.app { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
    .tag.pend { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .tag.rej { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
    .empty-row {
      color: #94a3b8;
      font-style: italic;
      padding: 10px !important;
      text-align: center;
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
      background: #e2e8f0;
      color: #334155;
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
      .tag, .summary-item, .info-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
      <h1>Relatório Funcional Individual</h1>
      <p>Secretaria de Saúde • Extrato Detalhado do Profissional em Formato de Grade</p>
    </div>
    <div class="header-meta">
      <p>Data de emissão: <strong>${emissionDate}</strong></p>
      <p>Situação do Cadastro: <strong style="color: #047857;">Ativo</strong></p>
    </div>
  </div>

  <div class="info-box">
    <div class="info-cell">
      <span class="info-label">Profissional</span>
      <span class="info-val">${esc(employeeName)}</span>
    </div>
    <div class="info-cell">
      <span class="info-label">Categoria</span>
      <span class="info-val">${esc(empCategoryName)}</span>
    </div>
    <div class="info-cell">
      <span class="info-label">Unidade de Lotação</span>
      <span class="info-val">${esc(empUnitName)}</span>
    </div>
    <div class="info-cell">
      <span class="info-label">Situação Cadastral</span>
      <span class="info-val" style="color: #047857;">Ativo</span>
    </div>
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
      <div class="value" style="color: ${balance >= 0 ? '#047857' : '#b91c1c'};">${balance > 0 ? '+' : ''}${fmtCredit(balance)}</div>
    </div>
  </div>

  <!-- Bloco 1: Escalas e Plantões Extras -->
  <div class="unit-block">
    <div class="unit-header">
      <div class="unit-title">
        <span>1. Escalas e Plantões Extras Realizados</span>
        <span class="unit-count">${schedules.length} ${schedules.length === 1 ? 'registro' : 'registros'}</span>
      </div>
      <div class="unit-stats">
        <span>Créditos de Plantões: <strong style="color: #1d4ed8;">+${fmtCredit(totalShifts)}</strong></span>
      </div>
    </div>
    <table class="grid-table">
      <thead>
        <tr>
          <th style="width: 17%;">Data / Dia</th>
          <th style="width: 22%;">Tipo / Créditos</th>
          <th style="width: 18%;">Unidade</th>
          <th style="width: 13%;">Turno</th>
          <th style="width: 30%;">Atividade Realizada / O que foi escalado(a)</th>
        </tr>
      </thead>
      <tbody>
        ${schedules.length === 0 ? `
          <tr><td colspan="5" class="empty-row">Nenhuma escala registrada no período.</td></tr>
        ` : schedules.map(s => {
          const creds = getScheduleCredits(s);
          return `
            <tr>
              <td><strong>${fmtDate(s.date)}</strong> <span style="color:#64748b;">(${weekday(s.date)})</span></td>
              <td>
                ${s.type === 'extra'
                  ? `<span class="tag extra">Plantão Extra (+${fmtCredit(creds)})</span>`
                  : `<span class="tag normal">Escala Normal</span>`}
              </td>
              <td>${esc(getUnitName(s.unit_id))}</td>
              <td>${s.shift_type === 'half' ? 'Meio Turno' : 'Integral'}</td>
              <td>${esc(s.observations?.trim() || 'Plantão de escala na unidade')}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>

  <!-- Bloco 2: Pedidos de Folga -->
  <div class="unit-block">
    <div class="unit-header">
      <div class="unit-title">
        <span>2. Pedidos de Folga e Motivos Declarados</span>
        <span class="unit-count">${leaves.length} ${leaves.length === 1 ? 'solicitação' : 'solicitações'}</span>
      </div>
      <div class="unit-stats">
        <span>Folgas Usufruídas: <strong style="color: #b91c1c;">-${fmtCredit(totalUsed)}</strong></span>
      </div>
    </div>
    <table class="grid-table">
      <thead>
        <tr>
          <th style="width: 14%;">Situação</th>
          <th style="width: 10%;">Qtd</th>
          <th style="width: 24%;">Datas da Folga</th>
          <th style="width: 38%;">Motivo Declarado</th>
          <th style="width: 14%;">Data do Pedido</th>
        </tr>
      </thead>
      <tbody>
        ${leaves.length === 0 ? `
          <tr><td colspan="5" class="empty-row">Nenhum pedido de folga registrado.</td></tr>
        ` : leaves.map(l => {
          const statusTag = l.status === 'approved'
            ? '<span class="tag app">Aprovado</span>'
            : l.status === 'rejected'
            ? '<span class="tag rej">Negado</span>'
            : '<span class="tag pend">Pendente</span>';
          const datesFormatted = (l.leave_dates ?? []).map(d => fmtDate(d)).join(', ');
          return `
            <tr>
              <td>${statusTag}</td>
              <td><strong>${l.days_requested}</strong> dia(s)</td>
              <td>${esc(datesFormatted || '—')}</td>
              <td>${esc(l.observations?.trim() || 'Motivo não informado no pedido')}</td>
              <td>${fmtDate(l.created_at)}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>

  <!-- Bloco 3: Ajustes Manuais de Crédito -->
  <div class="unit-block">
    <div class="unit-header">
      <div class="unit-title">
        <span>3. Ajustes Manuais e Histórico de Créditos</span>
        <span class="unit-count">${manualCredits.length} ${manualCredits.length === 1 ? 'registro' : 'registros'}</span>
      </div>
      <div class="unit-stats">
        <span>Saldo de Ajustes: <strong style="color: #b45309;">${totalManual > 0 ? '+' : ''}${fmtCredit(totalManual)}</strong></span>
      </div>
    </div>
    <table class="grid-table">
      <thead>
        <tr>
          <th style="width: 16%;">Data</th>
          <th style="width: 24%;">Tipo de Movimentação</th>
          <th style="width: 16%;">Quantidade</th>
          <th style="width: 44%;">Justificativa / Motivo do Ajuste</th>
        </tr>
      </thead>
      <tbody>
        ${manualCredits.length === 0 ? `
          <tr><td colspan="4" class="empty-row">Nenhum ajuste manual registrado.</td></tr>
        ` : manualCredits.map(c => {
          const isAdd = Number(c.amount) > 0;
          return `
            <tr>
              <td>${fmtDate(c.created_at)}</td>
              <td>
                <span class="tag ${isAdd ? 'add' : 'rem'}">
                  ${isAdd ? 'Manual Adicionado' : 'Manual Retirado'}
                </span>
              </td>
              <td><strong style="color: ${isAdd ? '#92400e' : '#6b21a8'};">${isAdd ? '+' : ''}${fmtCredit(c.amount)}</strong></td>
              <td>${esc(c.notes?.trim() || 'Ajuste manual lançado no sistema')}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  </div>

  ${transfers.length > 0 ? `
  <!-- Bloco 4: Transferências entre Unidades -->
  <div class="unit-block">
    <div class="unit-header">
      <div class="unit-title">
        <span>4. Histórico de Transferências entre Unidades</span>
        <span class="unit-count">${transfers.length}</span>
      </div>
    </div>
    <table class="grid-table">
      <thead>
        <tr>
          <th style="width: 22%;">Data da Transferência</th>
          <th style="width: 39%;">Unidade de Origem</th>
          <th style="width: 39%;">Unidade de Destino</th>
        </tr>
      </thead>
      <tbody>
        ${transfers.map(t => `
          <tr>
            <td><strong>${fmtDate(t.transferred_at)}</strong> <span style="color:#64748b;">(${weekday(t.transferred_at)})</span></td>
            <td>${esc(getUnitName(t.from_unit_id))}</td>
            <td><strong>${esc(getUnitName(t.to_unit_id))}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <div class="footer">
    Documento individual emitido eletronicamente pelo Sistema de Gestão de Escalas da Secretaria de Saúde
  </div>
</body>
</html>`;
  };

  // Dispara visualização / impressão do histórico em PDF
  const handlePrintPdf = () => {
    try {
      const html = buildIndividualPrintHtml();
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('O navegador bloqueou a abertura da janela. Permita popups para visualizar a ficha.');
        return;
      }
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (err: any) {
      toast.error('Erro ao gerar PDF: ' + (err.message || ''));
    }
  };

  // Baixar Planilha Excel (.csv) com histórico do profissional
  const handleDownloadExcel = () => {
    try {
      let csv = '\uFEFF';
      csv += `RELATÓRIO INDIVIDUAL - ${employeeName.toUpperCase()}\n`;
      csv += `Categoria: ${empCategoryName};Unidade: ${empUnitName};Saldo Atual: ${fmtCredit(balance)}\n\n`;

      csv += 'ESCALAS E ATIVIDADES REALIZADAS\n';
      csv += 'Data;Tipo;Créditos Ganhos;Unidade;Turno;O que foi escalado(a) para fazer\n';
      schedules.forEach(s => {
        const creds = getScheduleCredits(s);
        const typeLabel = s.type === 'extra' ? `Plantão Extra (+${fmtCredit(creds)})` : 'Escala Normal';
        const creditCol = s.type === 'extra' ? `+${fmtCredit(creds)}` : '0';
        csv += `"${fmtDate(s.date)}";"${typeLabel}";"${creditCol}";"${getUnitName(s.unit_id)}";"${s.shift_type === 'half' ? 'Meio Turno' : 'Integral'}";"${(s.observations || '').replace(/"/g, '""')}"\n`;
      });

      csv += '\nPEDIDOS DE FOLGA E MOTIVOS\n';
      csv += 'Situacao;Dias;Datas Solicitadas;Motivo da Folga;Data do Pedido\n';
      leaves.forEach(l => {
        const datesStr = (l.leave_dates ?? []).map(d => fmtDate(d)).join(', ');
        const statusCfg = statusLabels[l.status] ?? statusLabels.pending;
        csv += `"${statusCfg.label}";"${l.days_requested}";"${datesStr}";"${(l.observations || '').replace(/"/g, '""')}";"${fmtDate(l.created_at)}"\n`;
      });

      const manualCredits = credits.filter(c => c.origin !== 'extra_shift' && c.origin !== 'leave_used');
      if (manualCredits.length > 0) {
        csv += '\nAJUSTES MANUAIS DE CRÉDITO\n';
        csv += 'Data;Tipo;Quantidade;Justificativa\n';
        manualCredits.forEach(c => {
          const type = Number(c.amount) > 0 ? 'Manual Adicionado' : 'Manual Retirado';
          csv += `"${fmtDate(c.created_at)}";"${type}";"${c.amount > 0 ? '+' : ''}${fmtCredit(c.amount)}";"${(c.notes || '').replace(/"/g, '""')}"\n`;
        });
      }

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const cleanName = employeeName.toLowerCase().replace(/\s+/g, '-');
      a.href = url;
      a.download = `relatorio-individual-${cleanName}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Planilha Excel baixada com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao exportar planilha: ' + (err.message || ''));
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap pr-6">
            <div className="flex items-center gap-3">
              <Avatar className="w-12 h-12 rounded-full border border-border shadow-xs shrink-0">
                <AvatarImage src={empAvatarUrl || undefined} alt={employeeName} className="object-cover" />
                <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                  {employeeName ? employeeName.slice(0, 2).toUpperCase() : 'PS'}
                </AvatarFallback>
              </Avatar>
              <div>
                <DialogTitle className="text-lg">{employeeName}</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {empCategoryName} • {empUnitName}
                </p>
              </div>
            </div>

            {/* Apenas PDF e Excel - sem HTML */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCodeOpen(true)}
                title="Visualizar e compartilhar código de acesso do portal"
                className="gap-1.5 text-xs font-medium text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
              >
                <KeyRound size={14} />
                <span>Código Portal</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrintPdf}
                className="gap-1.5 text-xs font-medium"
              >
                <Printer size={14} className="text-primary" />
                <span>Gerar PDF</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadExcel}
                className="gap-1.5 text-xs font-medium"
              >
                <FileSpreadsheet size={14} className="text-emerald-600" />
                <span>Excel</span>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>
        ) : (
          <>
            {/* Balance summary */}
            <div className="grid grid-cols-4 gap-2 mb-2">
              <div className="rounded-lg border border-border p-2.5 text-center bg-card">
                <p className="text-base font-bold text-primary">+{fmtCredit(totalShifts)}</p>
                <p className="text-[10px] text-muted-foreground">Plantões</p>
              </div>
              <div className="rounded-lg border border-border p-2.5 text-center bg-card">
                <p className="text-base font-bold text-amber-600 dark:text-amber-400">
                  {totalManual > 0 ? `+${fmtCredit(totalManual)}` : fmtCredit(totalManual)}
                </p>
                <p className="text-[10px] text-muted-foreground">Manuais</p>
              </div>
              <div className="rounded-lg border border-border p-2.5 text-center bg-card">
                <p className="text-base font-bold text-destructive">-{fmtCredit(totalUsed)}</p>
                <p className="text-[10px] text-muted-foreground">Folgas</p>
              </div>
              <div className="rounded-lg border border-border p-2.5 text-center bg-card">
                <p className={cn('text-base font-bold', balance > 0 ? 'text-primary' : balance < 0 ? 'text-destructive' : 'text-foreground')}>
                  {balance > 0 ? `+${fmtCredit(balance)}` : fmtCredit(balance)}
                </p>
                <p className="text-[10px] text-muted-foreground">Saldo</p>
              </div>
            </div>

            <Tabs defaultValue="schedules">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="schedules" className="gap-1 text-xs">
                  <CalendarDays size={12} /> Escalas ({schedules.length})
                </TabsTrigger>
                <TabsTrigger value="leaves" className="gap-1 text-xs">
                  <CalendarOff size={12} /> Folgas ({leaves.length})
                </TabsTrigger>
                <TabsTrigger value="transfers" className="gap-1 text-xs">
                  <ArrowRightLeft size={12} /> Transf. ({transfers.length})
                </TabsTrigger>
                <TabsTrigger value="credits" className="gap-1 text-xs">
                  <Wallet size={12} /> Créditos ({credits.length})
                </TabsTrigger>
              </TabsList>

              {/* ABA: ESCALAS COM O QUE FOI ESCALADO PARA FAZER E QUANTIDADE EXATA DE CRÉDITOS */}
              <TabsContent value="schedules" className="mt-3 max-h-[340px] overflow-y-auto space-y-2">
                {schedules.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-6">Nenhuma escala registrada</p>
                ) : (
                  schedules.map(s => {
                    const creds = getScheduleCredits(s);
                    return (
                      <div key={s.id} className="p-3 rounded-lg border border-border bg-card space-y-1.5 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{fmtDate(s.date)}</span>
                            <span className="text-xs text-muted-foreground">({weekday(s.date)})</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px]">
                              {s.shift_type === 'half' ? 'Meio Turno' : 'Integral'}
                            </Badge>
                            <Badge variant={s.type === 'extra' ? 'default' : 'secondary'} className="text-[10px]">
                              {s.type === 'extra' ? `Plantão Extra (+${fmtCredit(creds)})` : 'Normal'}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Building2 size={13} className="shrink-0 text-muted-foreground" />
                          <span>Unidade: <strong>{getUnitName(s.unit_id)}</strong></span>
                        </div>

                        {/* Atividade / O que a pessoa foi escalada para fazer */}
                        <div className="text-xs bg-muted/40 p-2 rounded border border-border/50 text-foreground">
                          <span className="font-semibold text-foreground">Atividade: </span>
                          <span>{s.observations?.trim() || 'Plantão de rotina na unidade.'}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>

              {/* ABA: FOLGAS COM MOTIVO */}
              <TabsContent value="leaves" className="mt-3 max-h-[340px] overflow-y-auto space-y-2">
                {leaves.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-6">Nenhum pedido de folga</p>
                ) : (
                  leaves.map(l => {
                    const cfg = statusLabels[l.status] ?? statusLabels.pending;
                    return (
                      <div key={l.id} className="p-3 rounded-lg border border-border bg-card space-y-1.5 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{l.days_requested} dia(s) solicitado(s)</span>
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          <strong>Datas:</strong> {l.leave_dates?.map(d => fmtDate(d)).join(', ')}
                        </p>

                        {/* Motivo da folga */}
                        <div className="text-xs bg-muted/40 p-2 rounded border border-border/50 text-foreground">
                          <span className="font-semibold text-foreground">Motivo: </span>
                          <span>{l.observations?.trim() || 'Motivo não informado na solicitação.'}</span>
                        </div>

                        <p className="text-[10px] text-muted-foreground pt-0.5">
                          Solicitado em {fmtDate(l.created_at)}
                          {l.decided_at ? ` • Decidido em ${fmtDate(l.decided_at)}` : ''}
                        </p>
                      </div>
                    );
                  })
                )}
              </TabsContent>

              {/* ABA: TRANSFERÊNCIAS (DESIGN CONSISTENTE EM CARDS) */}
              <TabsContent value="transfers" className="mt-3 max-h-[340px] overflow-y-auto space-y-2">
                {transfers.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-6">Nenhuma transferência registrada</p>
                ) : (
                  transfers.map(t => (
                    <div key={t.id} className="p-3 rounded-lg border border-border bg-card space-y-1.5 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm">{fmtDate(t.transferred_at)}</span>
                          <span className="text-xs text-muted-foreground">({weekday(t.transferred_at)})</span>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          Transferência
                        </Badge>
                      </div>

                      <div className="text-xs bg-muted/40 p-2 rounded border border-border/50 text-foreground">
                        <span className="font-semibold text-foreground">Movimentação: </span>
                        <span>{getUnitName(t.from_unit_id)} → <strong>{getUnitName(t.to_unit_id)}</strong></span>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              {/* ABA: CRÉDITOS (COM CORES DISTINTAS PARA MANUAL COLOCADO E RETIRADO) */}
              <TabsContent value="credits" className="mt-3 max-h-[340px] overflow-y-auto space-y-2">
                {credits.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-6">Nenhum crédito registrado</p>
                ) : (
                  credits.map((c, i) => {
                    const isShift = c.origin === 'extra_shift';
                    const isLeave = c.origin === 'leave_used';
                    const isManualAdd = !isShift && !isLeave && Number(c.amount) > 0;
                    const isManualRemove = !isShift && !isLeave && Number(c.amount) < 0;

                    let badgeLabel = 'Crédito';
                    let badgeClass = 'bg-muted text-muted-foreground border-border';
                    let borderHighlight = 'border-border';
                    let boxBg = 'bg-muted/40';

                    if (isShift) {
                      badgeLabel = `Plantão Extra (+${fmtCredit(c.amount)})`;
                      badgeClass = 'bg-primary/10 text-primary border-primary/20 font-semibold';
                    } else if (isManualAdd) {
                      badgeLabel = `Manual Adicionado (+${fmtCredit(c.amount)})`;
                      badgeClass = 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700/60 font-semibold';
                      borderHighlight = 'border-amber-300 dark:border-amber-900/50';
                      boxBg = 'bg-amber-500/10 dark:bg-amber-950/25';
                    } else if (isManualRemove) {
                      badgeLabel = `Manual Retirado (-${fmtCredit(Math.abs(c.amount))})`;
                      badgeClass = 'bg-purple-500/15 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-700/60 font-semibold';
                      borderHighlight = 'border-purple-300 dark:border-purple-900/50';
                      boxBg = 'bg-purple-500/10 dark:bg-purple-950/25';
                    } else if (isLeave) {
                      badgeLabel = `Folga Utilizada (-${fmtCredit(Math.abs(c.amount))})`;
                      badgeClass = 'bg-destructive/10 text-destructive border-destructive/20 font-semibold';
                    }

                    return (
                      <div key={c.id || i} className={`p-3 rounded-lg border ${borderHighlight} bg-card space-y-1.5 hover:bg-muted/30 transition-colors`}>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{fmtDate(c.created_at)}</span>
                            <span className="text-xs text-muted-foreground">({weekday(c.created_at)})</span>
                          </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] border ${badgeClass}`}>
                            {badgeLabel}
                          </span>
                        </div>

                        {/* Justificativa / Observação do lançamento com cor de contexto */}
                        <div className={`text-xs ${boxBg} p-2 rounded border border-border/50 text-foreground`}>
                          <span className="font-semibold text-foreground">
                            {isManualAdd
                              ? 'Justificativa do crédito manual: '
                              : isManualRemove
                              ? 'Motivo da retirada/estorno manual: '
                              : isShift
                              ? 'Origem: '
                              : 'Descrição: '}
                          </span>
                          <span>
                            {c.notes?.trim() ||
                              (isShift
                                ? 'Crédito automático de plantão extra na escala.'
                                : isLeave
                                ? 'Débito referente a folga usufruída.'
                                : c.origin === 'initial_balance'
                                ? 'Lançamento de saldo inicial.'
                                : 'Ajuste manual de créditos.')}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>

    <AccessCodeDialog
      open={codeOpen}
      onOpenChange={setCodeOpen}
      employee={
        employeeId
          ? {
              id: employeeId,
              name: employeeName,
              phone: empPhone,
              unit_name: empUnitName,
              category_name: empCategoryName,
            }
          : null
      }
    />
  </>
  );
}
