import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CalendarDays,
  CalendarOff,
  ArrowRightLeft,
  Wallet,
  Loader2,
  Printer,
  Download,
  FileText,
  Building2,
  Stethoscope,
  MessageSquare,
} from 'lucide-react';
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
    return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!employeeId || !open) return;
    setLoading(true);

    Promise.all([
      // 1. Escalas completas (com observação/atividade, unidade e turno)
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

      // 4. Extrato de créditos com justificativas manuais
      supabase
        .from('leave_credits')
        .select('id, amount, origin, notes, created_at')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false }),

      // 5. Unidades e Categorias
      supabase.from('units').select('id, name'),
      supabase.from('categories').select('id, name'),

      // 6. Dados do próprio profissional (categoria e unidade)
      supabase.from('employees').select('id, category_id, unit_id').eq('id', employeeId).maybeSingle(),
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
      }

      setLoading(false);
    });
  }, [employeeId, open]);

  const getUnitName = (id: string | null) => (id ? units.find(u => u.id === id)?.name ?? '—' : empUnitName);

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

  // Constrói o dossiê individual do funcionário com o mesmo design visual do sistema
  const buildIndividualHtmlReport = (): string => {
    const emissionDate = new Date().toLocaleString('pt-BR');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Histórico de ${employeeName} — Saúde+</title>
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
    .container { max-width: 900px; margin: 0 auto; }
    
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

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 14px;
      margin-bottom: 24px;
    }
    .kpi-card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .kpi-value { font-size: 22px; font-weight: 800; }
    .kpi-label { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600; margin-top: 2px; }
    .text-primary { color: var(--primary); }
    .text-destructive { color: var(--destructive); }
    .text-amber { color: var(--amber); }

    .section-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--foreground);
      margin: 24px 0 12px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .table-container {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 14px;
      overflow-x: auto;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      margin-bottom: 20px;
    }
    .data-table { width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; min-width: 650px; }
    .data-table th {
      background: #f1f5f9;
      color: #475569;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 700;
      padding: 10px 14px;
      border-bottom: 1px solid var(--border);
    }
    .data-table td {
      padding: 12px 14px;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: top;
    }
    .data-table tr:last-child td { border-bottom: none; }
    .data-table tr:hover td { background: #f8fafc; }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 6px;
      font-family: monospace;
      font-weight: 700;
      font-size: 11px;
    }
    .badge-primary { background: var(--primary-light); color: var(--primary); }
    .badge-destructive { background: var(--destructive-light); color: var(--destructive); }
    .badge-amber { background: var(--amber-light); color: var(--amber); }
    .badge-neutral { background: #f1f5f9; color: #475569; }

    .obs-box {
      background: #f8fafc;
      border-left: 3px solid var(--primary);
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 12px;
      color: #334155;
      margin-top: 4px;
    }
    .obs-leave {
      border-left-color: var(--destructive);
      background: #fff5f5;
    }

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
    }
    .btn-secondary { background: #f1f5f9; color: #334155; }

    @media print {
      body { background: white; padding: 0; }
      .container { max-width: 100%; }
      .header { border: none; box-shadow: none; padding: 0 0 14px 0; border-bottom: 2px solid var(--border); border-radius: 0; margin-bottom: 14px; }
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
      .kpi-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
      .kpi-card { padding: 12px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">
        <div class="logo-badge">+</div>
        <div class="title">
          <h1>${employeeName}</h1>
          <p>${empCategoryName} • Unidade: ${empUnitName}</p>
        </div>
      </div>
      <div class="meta">
        <p><strong>Saúde+</strong> • Dossiê Individual</p>
        <p>Emitido em: ${emissionDate}</p>
      </div>
    </div>

    <!-- Cards de Resumo -->
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
        <div class="kpi-value">${balance > 0 ? '+' : ''}${fmtCredit(balance)}</div>
        <div class="kpi-label">Saldo Atual</div>
      </div>
    </div>

    <!-- Seção de Escalas (O que foi escalado para fazer) -->
    <div class="section-title">
      📅 Escalas e Atividades Realizadas (${schedules.length})
    </div>
    <div class="table-container">
      ${schedules.length === 0 ? `
        <p style="padding: 24px; text-align: center; color: #64748b;">Nenhuma escala registrada.</p>
      ` : `
        <table class="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Tipo</th>
              <th>Unidade</th>
              <th>Turno</th>
              <th>Atividade / O que foi escalado(a) para fazer</th>
            </tr>
          </thead>
          <tbody>
            ${schedules.map(s => `
              <tr>
                <td style="white-space: nowrap; font-weight: 600;">${fmtDate(s.date)} (${weekday(s.date)})</td>
                <td>
                  <span class="badge ${s.type === 'extra' ? 'badge-primary' : 'badge-neutral'}">
                    ${s.type === 'extra' ? 'Plantão Extra' : 'Escala Normal'}
                  </span>
                </td>
                <td>${getUnitName(s.unit_id)}</td>
                <td>${s.shift_type === 'half' ? 'Meio Turno' : 'Integral'}</td>
                <td>
                  <div class="obs-box">
                    ${s.observations?.trim() || 'Plantão de rotina na unidade'}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>

    <!-- Seção de Folgas (Motivo da folga) -->
    <div class="section-title">
      🏖️ Pedidos de Folga e Motivos (${leaves.length})
    </div>
    <div class="table-container">
      ${leaves.length === 0 ? `
        <p style="padding: 24px; text-align: center; color: #64748b;">Nenhum pedido de folga registrado.</p>
      ` : `
        <table class="data-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Dias</th>
              <th>Datas da Folga</th>
              <th>Motivo da Folga</th>
              <th>Data do Pedido</th>
            </tr>
          </thead>
          <tbody>
            ${leaves.map(l => {
              const statusCfg = statusLabels[l.status] ?? statusLabels.pending;
              const badgeClass = l.status === 'approved' ? 'badge-primary' : l.status === 'rejected' ? 'badge-destructive' : 'badge-neutral';
              const datesFormatted = (l.leave_dates ?? []).map(d => fmtDate(d)).join(', ');
              return `
                <tr>
                  <td><span class="badge ${badgeClass}">${statusCfg.label}</span></td>
                  <td style="font-weight: 600;">${l.days_requested} dia(s)</td>
                  <td>${datesFormatted || '—'}</td>
                  <td>
                    <div class="obs-box obs-leave">
                      ${l.observations?.trim() || 'Motivo não informado no pedido'}
                    </div>
                  </td>
                  <td style="white-space: nowrap; color: #64748b;">${fmtDate(l.created_at)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `}
    </div>

    <!-- Seção de Créditos Manuais e Ajustes -->
    <div class="section-title">
      ⭐ Créditos e Ajustes de Saldo (${credits.length})
    </div>
    <div class="table-container">
      ${credits.length === 0 ? `
        <p style="padding: 24px; text-align: center; color: #64748b;">Nenhum crédito registrado.</p>
      ` : `
        <table class="data-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Valor</th>
              <th>Origem</th>
              <th>Motivo / Observações</th>
            </tr>
          </thead>
          <tbody>
            ${credits.map(c => `
              <tr>
                <td style="white-space: nowrap;">${fmtDate(c.created_at)}</td>
                <td>
                  <span class="badge ${c.amount > 0 ? 'badge-primary' : 'badge-destructive'}">
                    ${c.amount > 0 ? '+' : ''}${fmtCredit(c.amount)}
                  </span>
                </td>
                <td>
                  ${c.origin === 'extra_shift' ? 'Plantão extra' : c.origin === 'leave_used' ? 'Folga utilizada' : c.origin === 'initial_balance' ? 'Saldo inicial' : 'Ajuste manual'}
                </td>
                <td>${c.notes || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
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

  // Dispara visualização / impressão do histórico
  const handlePrintHistory = () => {
    try {
      const html = buildIndividualHtmlReport();
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('O navegador bloqueou a abertura da janela. Permita popups para visualizar o histórico.');
        return;
      }
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (err: any) {
      toast.error('Erro ao gerar relatório individual: ' + (err.message || ''));
    }
  };

  // Baixar arquivo HTML individual
  const handleDownloadHtmlHistory = () => {
    try {
      const html = buildIndividualHtmlReport();
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const cleanName = employeeName.toLowerCase().replace(/\s+/g, '-');
      a.href = url;
      a.download = `historico-${cleanName}-${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Dossiê do profissional baixado com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao baixar arquivo: ' + (err.message || ''));
    }
  };

  // Baixar CSV com escalas e folgas da pessoa
  const handleDownloadCsvHistory = () => {
    try {
      let csv = '\uFEFF';
      csv += `Histórico de ${employeeName} - Categoria: ${empCategoryName} - Unidade: ${empUnitName}\n\n`;

      csv += 'ESCALAS E ATIVIDADES\n';
      csv += 'Data;Tipo;Unidade;Turno;O que foi escalado(a) para fazer\n';
      schedules.forEach(s => {
        csv += `"${fmtDate(s.date)}";"${s.type === 'extra' ? 'Plantão Extra' : 'Escala Normal'}";"${getUnitName(s.unit_id)}";"${s.shift_type === 'half' ? 'Meio Turno' : 'Integral'}";"${(s.observations || '').replace(/"/g, '""')}"\n`;
      });

      csv += '\nPEDIDOS DE FOLGA E MOTIVOS\n';
      csv += 'Status;Dias;Datas Solicitadas;Motivo da Folga;Data do Pedido\n';
      leaves.forEach(l => {
        const datesStr = (l.leave_dates ?? []).map(d => fmtDate(d)).join(', ');
        csv += `"${l.status}";"${l.days_requested}";"${datesStr}";"${(l.observations || '').replace(/"/g, '""')}";"${fmtDate(l.created_at)}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const cleanName = employeeName.toLowerCase().replace(/\s+/g, '-');
      a.href = url;
      a.download = `historico-${cleanName}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Planilha do profissional baixada!');
    } catch (err: any) {
      toast.error('Erro ao exportar planilha: ' + (err.message || ''));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 flex-wrap pr-6">
            <div>
              <DialogTitle className="text-lg">{employeeName}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {empCategoryName} • {empUnitName}
              </p>
            </div>

            {/* Botão Baixar / Imprimir Histórico */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs font-semibold">
                  <Download size={14} />
                  <span>Baixar Histórico</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handlePrintHistory} className="gap-2 cursor-pointer">
                  <Printer size={14} className="text-primary" />
                  <span>Visualizar & Imprimir (PDF)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadHtmlHistory} className="gap-2 cursor-pointer">
                  <FileText size={14} className="text-primary" />
                  <span>Baixar Arquivo HTML</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadCsvHistory} className="gap-2 cursor-pointer">
                  <Download size={14} className="text-amber-600" />
                  <span>Baixar Planilha (Excel)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>
        ) : (
          <>
            {/* Balance summary */}
            <div className="grid grid-cols-4 gap-2 mb-2">
              <div className="rounded-xl border border-border p-2.5 text-center">
                <p className="text-base font-bold text-primary">+{fmtCredit(totalShifts)}</p>
                <p className="text-[10px] text-muted-foreground">Plantões</p>
              </div>
              <div className="rounded-xl border border-border p-2.5 text-center">
                <p className="text-base font-bold text-amber-600 dark:text-amber-400">
                  {totalManual > 0 ? `+${fmtCredit(totalManual)}` : fmtCredit(totalManual)}
                </p>
                <p className="text-[10px] text-muted-foreground">Manuais</p>
              </div>
              <div className="rounded-xl border border-border p-2.5 text-center">
                <p className="text-base font-bold text-destructive">-{fmtCredit(totalUsed)}</p>
                <p className="text-[10px] text-muted-foreground">Folgas</p>
              </div>
              <div className="rounded-xl border border-border p-2.5 text-center">
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

              {/* ABA: ESCALAS COM O QUE FOI ESCALADO PARA FAZER */}
              <TabsContent value="schedules" className="mt-3 max-h-[340px] overflow-y-auto space-y-2">
                {schedules.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-6">Nenhuma escala registrada</p>
                ) : (
                  schedules.map(s => (
                    <div key={s.id} className="p-3 rounded-xl border border-border bg-card/60 space-y-2 hover:bg-muted/30 transition-colors">
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
                            {s.type === 'extra' ? 'Plantão Extra (+1)' : 'Normal'}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Building2 size={13} className="shrink-0 text-primary" />
                        <span>Unidade: <strong>{getUnitName(s.unit_id)}</strong></span>
                      </div>

                      {/* Destaque do que a pessoa foi escalada para fazer */}
                      <div className="flex items-start gap-1.5 text-xs bg-primary/5 border border-primary/10 p-2 rounded-lg text-foreground">
                        <Stethoscope size={14} className="text-primary shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-primary">Atividade / Função: </span>
                          <span>{s.observations?.trim() || 'Plantão de rotina na unidade.'}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </TabsContent>

              {/* ABA: FOLGAS COM MOTIVO CLARAMENTE IDENTIFICADO */}
              <TabsContent value="leaves" className="mt-3 max-h-[340px] overflow-y-auto space-y-2">
                {leaves.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-6">Nenhum pedido de folga</p>
                ) : (
                  leaves.map(l => {
                    const cfg = statusLabels[l.status] ?? statusLabels.pending;
                    return (
                      <div key={l.id} className="p-3 rounded-xl border border-border bg-card/60 space-y-2 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold">{l.days_requested} dia(s) solicitado(s)</span>
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        </div>

                        <p className="text-xs text-muted-foreground">
                          <strong>Datas:</strong> {l.leave_dates?.map(d => fmtDate(d)).join(', ')}
                        </p>

                        {/* Motivo da folga destacado */}
                        <div className="flex items-start gap-1.5 text-xs bg-destructive/5 border border-destructive/10 p-2 rounded-lg text-foreground">
                          <MessageSquare size={14} className="text-destructive shrink-0 mt-0.5" />
                          <div>
                            <span className="font-semibold text-destructive">Motivo da folga: </span>
                            <span>{l.observations?.trim() || 'Motivo não informado na solicitação.'}</span>
                          </div>
                        </div>

                        <p className="text-[10px] text-muted-foreground pt-1">
                          Pedido feito em {fmtDate(l.created_at)}
                          {l.decided_at ? ` • Decidido em ${fmtDate(l.decided_at)}` : ''}
                        </p>
                      </div>
                    );
                  })
                )}
              </TabsContent>

              {/* ABA: TRANSFERÊNCIAS */}
              <TabsContent value="transfers" className="mt-3 max-h-[300px] overflow-y-auto">
                {transfers.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-6">Nenhuma transferência</p>
                ) : (
                  <div className="space-y-1">
                    {transfers.map(t => (
                      <div key={t.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 text-sm">
                        <span>{getUnitName(t.from_unit_id)} → {getUnitName(t.to_unit_id)}</span>
                        <span className="text-xs text-muted-foreground">{fmtDate(t.transferred_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* ABA: CRÉDITOS */}
              <TabsContent value="credits" className="mt-3 max-h-[300px] overflow-y-auto">
                {credits.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-6">Nenhum crédito registrado</p>
                ) : (
                  <div className="space-y-1">
                    {credits.map((c, i) => (
                      <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 text-sm">
                        <div className="min-w-0 pr-2">
                          <span className={cn('font-mono font-bold', c.amount > 0 ? 'text-primary' : 'text-destructive')}>
                            {c.amount > 0 ? '+' : ''}{fmtCredit(c.amount)}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {c.origin === 'extra_shift'
                              ? 'Escala extra'
                              : c.origin === 'leave_used'
                              ? 'Folga utilizada'
                              : c.origin === 'initial_balance'
                              ? 'Saldo inicial'
                              : 'Ajuste manual'}
                          </span>
                          {c.notes && (
                            <p className="text-xs text-foreground/80 italic mt-0.5 pl-5">
                              "{c.notes}"
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{fmtDate(c.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
