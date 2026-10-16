/**
 * Painel de Saldo de Folgas — Panorama geral simples e direto.
 * Mostra créditos de plantões/escalas, ajustes manuais, folgas utilizadas e saldo final por profissional.
 */
import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useDataSubscription } from '@/hooks/useDataSubscription';
import { useAuthContext } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Wallet, Search, TrendingDown, CalendarDays, Sparkles, Eye, Download, X, RefreshCw } from 'lucide-react';
import EmployeeDetailDialog from '@/components/EmployeeDetailDialog';
import ReportExportDialog from '@/components/reports/ReportExportDialog';

interface Employee {
  id: string;
  name: string;
  category_id: string | null;
  unit_id: string | null;
}

interface Credit {
  id?: string;
  employee_id: string;
  amount: number;
  origin: string;
  notes?: string | null;
  created_at?: string;
}

interface Category { id: string; name: string; }
interface Unit { id: string; name: string; }

interface BalanceRow {
  employee: Employee;
  shifts: number;   // Créditos gerados por escalas/plantões extras
  manual: number;   // Créditos adicionados ou ajustados manualmente
  used: number;     // Créditos consumidos em folgas aprovadas
  balance: number;  // Saldo total final
  categoryName: string;
  unitName: string;
}

/** Paginação segura para buscar todos os registros sem limite de 1000 linhas */
async function fetchAll<T>(build: () => any): Promise<T[]> {
  const all: T[] = [];
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

const fmtCredit = (n: number) => (n % 1 === 0 ? n.toString() : n.toFixed(1).replace('.', ','));

export default function BalancePanel() {
  const { roleInfo, isAdmin, isChief, isManager, isRH } = useAuthContext();

  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [search, setSearch] = useState('');
  const [filterUnit, setFilterUnit] = useState('all');
  const [filterCat, setFilterCat] = useState('all');
  const [loading, setLoading] = useState(true);

  // Modais
  const [detailEmp, setDetailEmp] = useState<Employee | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const load = useCallback(async () => {
    const teamId = roleInfo?.team_id;
    if (!teamId) return;

    setLoading(true);

    // Consulta de funcionários com regras estritas de RBAC
    let empQuery = supabase
      .from('employees')
      .select('id, name, category_id, unit_id')
      .eq('team_id', teamId)
      .eq('active', true)
      .order('name');

    if (isChief && !isAdmin && !isRH && roleInfo?.category_ids?.length) {
      empQuery = empQuery.in('category_id', roleInfo.category_ids);
    }
    if (isManager && !isAdmin && !isRH && roleInfo?.unit_id) {
      empQuery = empQuery.eq('unit_id', roleInfo.unit_id);
    }

    const [empRes, credList, catRes, unitRes] = await Promise.all([
      empQuery,
      fetchAll<Credit>(() =>
        supabase
          .from('leave_credits')
          .select('id, employee_id, amount, origin, notes, created_at')
          .eq('team_id', teamId)
      ),
      supabase.from('categories').select('id, name').eq('team_id', teamId).order('name'),
      supabase.from('units').select('id, name').eq('team_id', teamId).order('name'),
    ]);

    const employees: Employee[] = empRes.data ?? [];
    let cats: Category[] = catRes.data ?? [];
    const unts: Unit[] = unitRes.data ?? [];

    if (isChief && !isAdmin && !isRH && roleInfo?.category_ids?.length) {
      cats = cats.filter(c => roleInfo.category_ids.includes(c.id));
    }

    const catMap = Object.fromEntries(cats.map(c => [c.id, c.name]));
    const unitMap = Object.fromEntries(unts.map(u => [u.id, u.name]));

    const balances: BalanceRow[] = employees.map(emp => {
      const empCredits = credList.filter(c => c.employee_id === emp.id);

      // 1. Plantões extras (escalas adicionadas)
      const shifts = empCredits
        .filter(c => c.origin === 'extra_shift')
        .reduce((sum, c) => sum + Number(c.amount), 0);

      // 2. Créditos manuais / ajustes (qualquer crédito que não seja de escala nem débito de folga)
      const manual = empCredits
        .filter(c => c.origin !== 'extra_shift' && c.origin !== 'leave_used')
        .reduce((sum, c) => sum + Number(c.amount), 0);

      // 3. Folgas utilizadas (débitos com origin = 'leave_used')
      const used = Math.abs(
        empCredits
          .filter(c => c.origin === 'leave_used')
          .reduce((sum, c) => sum + Number(c.amount), 0)
      );

      // 4. Saldo total final acumulado
      const balance = empCredits.reduce((sum, c) => sum + Number(c.amount), 0);

      return {
        employee: emp,
        shifts,
        manual,
        used,
        balance,
        categoryName: emp.category_id ? catMap[emp.category_id] ?? '—' : '—',
        unitName: emp.unit_id ? unitMap[emp.unit_id] ?? '—' : '—',
      };
    });

    // Ordenar por maior saldo primeiro, desempatando pelo nome
    balances.sort((a, b) => b.balance - a.balance || a.employee.name.localeCompare(b.employee.name));

    setCategories(cats);
    setUnits(unts);
    setRows(balances);
    setLoading(false);
  }, [roleInfo?.team_id, roleInfo?.category_ids, roleInfo?.unit_id, isAdmin, isChief, isManager, isRH]);

  useEffect(() => {
    load();
  }, [load]);

  // Atualização em tempo real caso haja nova escala, ajuste manual ou aprovação de folga
  useDataSubscription(['employees', 'leave_credits', 'categories', 'units'], load);

  // Filtragem dos registros (busca por texto, unidade e categoria)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      const matchesSearch =
        !q ||
        r.employee.name.toLowerCase().includes(q) ||
        r.categoryName.toLowerCase().includes(q) ||
        r.unitName.toLowerCase().includes(q);

      const matchesUnit = filterUnit === 'all' || r.employee.unit_id === filterUnit;
      const matchesCat = filterCat === 'all' || r.employee.category_id === filterCat;

      return matchesSearch && matchesUnit && matchesCat;
    });
  }, [rows, search, filterUnit, filterCat]);

  // Totais do panorama geral para os profissionais visíveis
  const totalShifts = useMemo(() => filtered.reduce((s, r) => s + r.shifts, 0), [filtered]);
  const totalManual = useMemo(() => filtered.reduce((s, r) => s + r.manual, 0), [filtered]);
  const totalUsed = useMemo(() => filtered.reduce((s, r) => s + r.used, 0), [filtered]);
  const totalBalance = useMemo(() => filtered.reduce((s, r) => s + r.balance, 0), [filtered]);

  const hasActiveFilters = search !== '' || filterUnit !== 'all' || filterCat !== 'all';

  const clearFilters = () => {
    setSearch('');
    setFilterUnit('all');
    setFilterCat('all');
  };

  const showUnitFilter = isAdmin || isRH || isChief;
  const showCategoryFilter = isAdmin || isRH || (isChief && (roleInfo?.category_ids?.length ?? 0) > 1);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho exclusivo para impressão direta (Ctrl+P) */}
      <div className="hidden print:block pb-4 border-b border-border mb-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-foreground">Saúde+ • Relatório de Saldo de Folgas</h1>
            <p className="text-xs text-muted-foreground">Panorama geral de plantões extras, ajustes manuais, folgas e saldo</p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>Emitido em: {new Date().toLocaleString('pt-BR')}</p>
            <p>Profissionais: {filtered.length}</p>
          </div>
        </div>
      </div>

      {/* Cabeçalho na Tela */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet size={24} className="text-primary" />
            Saldo de Folgas
          </h1>
          <p className="text-muted-foreground text-sm">
            Panorama geral de plantões extras, ajustes manuais, folgas e saldo por profissional
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={() => load()} title="Atualizar dados" className="gap-1.5">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>

          {/* Botão de Exportação com o mesmo visual e suporte a relatório detalhado */}
          <Button
            size="sm"
            onClick={() => setExportOpen(true)}
            className="gap-1.5 shadow-sm font-semibold"
          >
            <Download size={14} />
            <span>Exportar / Imprimir</span>
          </Button>
        </div>
      </div>

      {/* Cards de Resumo do Panorama Geral (mesmo design clássico de stat-cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Plantões Extras */}
        <div className="stat-card flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
            <CalendarDays size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-primary truncate">+{fmtCredit(totalShifts)}</p>
            <p className="text-xs text-muted-foreground truncate">Plantões extras</p>
          </div>
        </div>

        {/* Ajustes Manuais */}
        <div className="stat-card flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
            <Sparkles size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 truncate">
              {totalManual > 0 ? `+${fmtCredit(totalManual)}` : fmtCredit(totalManual)}
            </p>
            <p className="text-xs text-muted-foreground truncate">Créditos manuais</p>
          </div>
        </div>

        {/* Folgas Usadas */}
        <div className="stat-card flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive shrink-0">
            <TrendingDown size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-destructive truncate">-{fmtCredit(totalUsed)}</p>
            <p className="text-xs text-muted-foreground truncate">Folgas usadas</p>
          </div>
        </div>

        {/* Saldo Total */}
        <div className="stat-card flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-accent/10 text-accent-foreground shrink-0">
            <Wallet size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold truncate">
              {totalBalance > 0 ? `+${fmtCredit(totalBalance)}` : fmtCredit(totalBalance)}
            </p>
            <p className="text-xs text-muted-foreground truncate">Saldo total</p>
          </div>
        </div>
      </div>

      {/* Barra de Filtros Rápida e Simples (apenas texto, unidade e categoria) */}
      <div className="flex flex-wrap items-center gap-3 bg-card rounded-xl border border-border p-3 print:hidden">
        {/* Busca por texto */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input
            placeholder="Buscar por profissional, categoria ou unidade..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Filtro de Unidade */}
        {showUnitFilter && (
          <Select value={filterUnit} onValueChange={setFilterUnit}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Todas as Unidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Unidades</SelectItem>
              {units.map(u => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Filtro de Categoria */}
        {showCategoryFilter && (
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-[170px] h-9">
              <SelectValue placeholder="Todas as Categorias" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Categorias</SelectItem>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Botão Limpar Filtros */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 text-muted-foreground hover:text-foreground">
            <X size={14} />
            <span>Limpar</span>
          </Button>
        )}
      </div>

      {/* Indicador de resultados */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>Exibindo <strong>{filtered.length}</strong> de <strong>{rows.length}</strong> profissional(is)</span>
      </div>

      {/* Visualização de Dados */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
          <RefreshCw className="animate-spin text-primary" size={24} />
          <span>Carregando saldos...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state py-12 text-center bg-card rounded-xl border border-border">
          <Wallet className="mx-auto mb-3 text-muted-foreground" size={40} />
          <p className="text-foreground font-medium">Nenhum profissional encontrado</p>
          <p className="text-xs text-muted-foreground mt-1">Tente ajustar os filtros acima para encontrar resultados.</p>
        </div>
      ) : (
        <>
          {/* Mobile View: Cards */}
          <div className="space-y-3 sm:hidden">
            {filtered.map(row => (
              <div key={row.employee.id} className="page-card p-3.5 space-y-3 bg-card rounded-xl border border-border">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{row.employee.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {row.categoryName} • {row.unitName}
                    </p>
                  </div>
                  <Badge
                    variant={row.balance > 0 ? 'default' : row.balance < 0 ? 'destructive' : 'secondary'}
                    className="font-mono font-bold shrink-0"
                  >
                    {row.balance > 0 ? `+${fmtCredit(row.balance)}` : fmtCredit(row.balance)}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
                  <div className="bg-primary/5 p-2 rounded-lg flex flex-col items-center text-center">
                    <span className="text-[10px] text-primary uppercase font-bold tracking-tight">Plantões</span>
                    <span className="text-xs font-mono font-bold text-primary">+{fmtCredit(row.shifts)}</span>
                  </div>
                  <div className="bg-amber-500/5 p-2 rounded-lg flex flex-col items-center text-center">
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase font-bold tracking-tight">Manuais</span>
                    <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                      {row.manual !== 0 ? (row.manual > 0 ? `+${fmtCredit(row.manual)}` : fmtCredit(row.manual)) : '0'}
                    </span>
                  </div>
                  <div className="bg-destructive/5 p-2 rounded-lg flex flex-col items-center text-center">
                    <span className="text-[10px] text-destructive uppercase font-bold tracking-tight">Usados</span>
                    <span className="text-xs font-mono font-bold text-destructive">-{fmtCredit(row.used)}</span>
                  </div>
                </div>

                <div className="pt-1 flex justify-end print:hidden">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs gap-1.5 hover:bg-primary/10 hover:text-primary"
                    onClick={() => setDetailEmp(row.employee)}
                  >
                    <Eye size={14} /> Ver histórico
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop View: Tabela Limpa e Espaçada */}
          <div className="hidden sm:block bg-card rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="px-5 py-3.5 font-semibold">Profissional</th>
                    <th className="px-5 py-3.5 font-semibold">Categoria</th>
                    <th className="px-5 py-3.5 font-semibold">Unidade</th>
                    <th className="px-4 py-3.5 font-semibold text-center" title="Créditos obtidos em escalas e plantões extras">Plantões</th>
                    <th className="px-4 py-3.5 font-semibold text-center" title="Ajustes manuais e saldo inicial inseridos pela gestão">Manuais</th>
                    <th className="px-4 py-3.5 font-semibold text-center" title="Créditos descontados por folgas usufruídas">Folgas Usadas</th>
                    <th className="px-5 py-3.5 font-semibold text-center">Saldo Atual</th>
                    <th className="px-4 py-3.5 font-semibold text-right print:hidden">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(row => (
                    <tr key={row.employee.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 font-medium text-foreground">{row.employee.name}</td>
                      <td className="px-5 py-3 text-muted-foreground text-sm">{row.categoryName}</td>
                      <td className="px-5 py-3 text-muted-foreground text-sm">{row.unitName}</td>
                      
                      {/* Plantões Extras */}
                      <td className="px-4 py-3 text-center">
                        <Badge variant="secondary" className="font-mono bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary border-transparent">
                          +{fmtCredit(row.shifts)}
                        </Badge>
                      </td>

                      {/* Ajustes Manuais */}
                      <td className="px-4 py-3 text-center">
                        {row.manual !== 0 ? (
                          <Badge
                            variant="secondary"
                            className={`font-mono border-transparent ${
                              row.manual > 0
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {row.manual > 0 ? `+${fmtCredit(row.manual)}` : fmtCredit(row.manual)}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">—</span>
                        )}
                      </td>

                      {/* Folgas Usadas */}
                      <td className="px-4 py-3 text-center">
                        <Badge variant="secondary" className="font-mono bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive border-transparent">
                          -{fmtCredit(row.used)}
                        </Badge>
                      </td>

                      {/* Saldo Atual */}
                      <td className="px-5 py-3 text-center">
                        <Badge
                          variant={row.balance > 0 ? 'default' : row.balance < 0 ? 'destructive' : 'secondary'}
                          className="font-mono font-bold shadow-none"
                        >
                          {row.balance > 0 ? `+${fmtCredit(row.balance)}` : fmtCredit(row.balance)}
                        </Badge>
                      </td>

                      {/* Botão de Histórico */}
                      <td className="px-4 py-3 text-right print:hidden">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Ver histórico detalhado"
                          className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors"
                          onClick={() => setDetailEmp(row.employee)}
                        >
                          <Eye size={15} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal de Exportação / Impressão Detalhada com visual responsivo idêntico à página */}
      <ReportExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        teamId={roleInfo?.team_id ?? ''}
        categories={categories}
        units={units}
        rows={filtered}
        filterUnitName={filterUnit !== 'all' ? units.find(u => u.id === filterUnit)?.name : undefined}
        filterCatName={filterCat !== 'all' ? categories.find(c => c.id === filterCat)?.name : undefined}
      />

      {/* Modal de Detalhes Completo do Profissional (reutilizando componente padrão do sistema) */}
      <EmployeeDetailDialog
        employeeId={detailEmp?.id ?? null}
        employeeName={detailEmp?.name ?? ''}
        open={!!detailEmp}
        onOpenChange={o => {
          if (!o) setDetailEmp(null);
        }}
      />
    </div>
  );
}
