/**
 * Relatórios — visão mensal simples de escalas, folgas e saldo por profissional.
 * Busca apenas os dados do mês selecionado para manter a página leve.
 */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useDataSubscription } from '@/hooks/useDataSubscription';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, CalendarDays, CalendarOff, Wallet, Printer } from 'lucide-react';

interface Employee { id: string; name: string; category_id: string | null; unit_id: string | null; }
interface Category { id: string; name: string; }
interface Unit { id: string; name: string; }
interface Schedule { id: string; employee_id: string; date: string; shift_type: string | null; credit_amount: number | null; observations: string | null; }
interface LeaveReq { id: string; employee_id: string; leave_dates: string[] | null; observations: string | null; }
interface Credit { employee_id: string; amount: number; }

interface Entry {
  key: string;
  date: string;
  employeeId: string;
  kind: 'escala' | 'folga';
  shift: string;
  credit: number | null;
  obs: string;
}

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

/** Busca todas as linhas paginando de 1000 em 1000 (limite padrão do Supabase). */
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

const fmt = (n: number) => (n % 1 === 0 ? n.toString() : n.toFixed(1).replace('.', ','));
const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');
const weekday = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');

export default function BalancePanel() {
  const { roleInfo, isAdmin, isChief, isManager, isRH } = useAuthContext();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [filterUnit, setFilterUnit] = useState('all');
  const [filterCat, setFilterCat] = useState('all');
  const [filterEmp, setFilterEmp] = useState('all');
  const [filterKind, setFilterKind] = useState<'all' | 'escala' | 'folga'>('all');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [leaves, setLeaves] = useState<LeaveReq[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [loading, setLoading] = useState(true);

  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const monthPrefix = monthStart.slice(0, 7);

  // Dados base (profissionais, categorias, unidades e créditos) — respeitando o nível de acesso
  const loadBase = useCallback(async () => {
    const teamId = roleInfo?.team_id;
    if (!teamId) return;

    let empQ = supabase.from('employees').select('id, name, category_id, unit_id').eq('active', true).eq('team_id', teamId).order('name');
    if (isChief && !isAdmin && !isRH && roleInfo?.category_ids?.length) empQ = empQ.in('category_id', roleInfo.category_ids);
    if (isManager && !isAdmin && !isRH && roleInfo?.unit_id) empQ = empQ.eq('unit_id', roleInfo.unit_id);

    const [empRes, catRes, unitRes, cred] = await Promise.all([
      empQ,
      supabase.from('categories').select('id, name').eq('team_id', teamId).order('name'),
      supabase.from('units').select('id, name').eq('team_id', teamId).order('name'),
      fetchAll<Credit>(() => supabase.from('leave_credits').select('employee_id, amount').eq('team_id', teamId)),
    ]);

    let cats: Category[] = catRes.data ?? [];
    if (isChief && !isAdmin && !isRH && roleInfo?.category_ids?.length) {
      cats = cats.filter(c => roleInfo.category_ids.includes(c.id));
    }
    setEmployees(empRes.data ?? []);
    setCategories(cats);
    setUnits(unitRes.data ?? []);
    setCredits(cred);
  }, [roleInfo?.team_id, isAdmin, isChief, isManager, isRH]);

  // Dados do mês (escalas e folgas aprovadas)
  const loadMonth = useCallback(async () => {
    const teamId = roleInfo?.team_id;
    if (!teamId) return;
    setLoading(true);
    const [sch, lv] = await Promise.all([
      fetchAll<Schedule>(() =>
        supabase.from('schedules')
          .select('id, employee_id, date, shift_type, credit_amount, observations')
          .eq('team_id', teamId)
          .gte('date', monthStart)
          .lte('date', monthEnd)
          .order('date')
      ),
      fetchAll<LeaveReq>(() =>
        supabase.from('leave_requests')
          .select('id, employee_id, leave_dates, observations')
          .eq('team_id', teamId)
          .eq('status', 'approved')
      ),
    ]);
    setSchedules(sch);
    setLeaves(lv.filter(l => (l.leave_dates ?? []).some(d => d.startsWith(monthPrefix))));
    setLoading(false);
  }, [roleInfo?.team_id, monthStart, monthEnd, monthPrefix]);

  useEffect(() => { loadBase(); }, [loadBase]);
  useEffect(() => { loadMonth(); }, [loadMonth]);
  useDataSubscription(['schedules', 'leave_requests', 'leave_credits'], () => { loadMonth(); loadBase(); });

  // Mapas auxiliares
  const empMap = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);
  const catName = (id: string | null) => (id ? categories.find(c => c.id === id)?.name ?? '—' : '—');
  const unitName = (id: string | null) => (id ? units.find(u => u.id === id)?.name ?? '—' : '—');

  // Profissionais que passam nos filtros de unidade/categoria/profissional
  const visibleEmployees = useMemo(() => employees.filter(e =>
    (filterUnit === 'all' || e.unit_id === filterUnit) &&
    (filterCat === 'all' || e.category_id === filterCat) &&
    (filterEmp === 'all' || e.id === filterEmp)
  ), [employees, filterUnit, filterCat, filterEmp]);
  const visibleIds = useMemo(() => new Set(visibleEmployees.map(e => e.id)), [visibleEmployees]);

  // Lista de lançamentos do mês (escalas + folgas), em ordem de data
  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [];
    schedules.forEach(s => {
      if (!visibleIds.has(s.employee_id)) return;
      list.push({
        key: `s-${s.id}`,
        date: s.date,
        employeeId: s.employee_id,
        kind: 'escala',
        shift: s.shift_type === 'half' ? 'Meio turno' : 'Integral',
        credit: s.credit_amount != null ? Number(s.credit_amount) : null,
        obs: s.observations ?? '',
      });
    });
    leaves.forEach(l => {
      if (!visibleIds.has(l.employee_id)) return;
      (l.leave_dates ?? []).filter(d => d.startsWith(monthPrefix)).forEach(d => {
        list.push({
          key: `l-${l.id}-${d}`,
          date: d,
          employeeId: l.employee_id,
          kind: 'folga',
          shift: '—',
          credit: -1,
          obs: l.observations ?? '',
        });
      });
    });
    return list
      .filter(e => filterKind === 'all' || e.kind === filterKind)
      .sort((a, b) => a.date.localeCompare(b.date) || (empMap.get(a.employeeId)?.name ?? '').localeCompare(empMap.get(b.employeeId)?.name ?? ''));
  }, [schedules, leaves, visibleIds, filterKind, monthPrefix, empMap]);

  // Saldo atual por profissional
  const balanceMap = useMemo(() => {
    const m = new Map<string, number>();
    credits.forEach(c => m.set(c.employee_id, (m.get(c.employee_id) ?? 0) + Number(c.amount)));
    return m;
  }, [credits]);

  // Resumo por profissional
  const summary = useMemo(() => visibleEmployees.map(e => {
    const esc = schedules.filter(s => s.employee_id === e.id).length;
    const fol = leaves
      .filter(l => l.employee_id === e.id)
      .reduce((acc, l) => acc + (l.leave_dates ?? []).filter(d => d.startsWith(monthPrefix)).length, 0);
    return { emp: e, esc, fol, saldo: balanceMap.get(e.id) ?? 0 };
  }), [visibleEmployees, schedules, leaves, balanceMap, monthPrefix]);

  const totalEsc = summary.reduce((a, r) => a + r.esc, 0);
  const totalFol = summary.reduce((a, r) => a + r.fol, 0);
  const totalSaldo = summary.reduce((a, r) => a + r.saldo, 0);

  const showCategoryFilter = isAdmin || isRH || (isChief && (roleInfo?.category_ids?.length ?? 0) > 1);
  const showUnitFilter = isAdmin || isRH || isChief;
  const years = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  const cell = 'px-3 py-2 border border-border';
  const head = 'px-3 py-2 border border-border font-semibold text-left';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText size={24} className="text-primary" />
            Relatórios
          </h1>
          <p className="text-muted-foreground text-sm">Escalas, folgas e saldo por profissional no mês</p>
        </div>
        <Button variant="outline" onClick={() => window.print()} className="gap-2 print:hidden">
          <Printer size={16} /> Imprimir
        </Button>
      </div>

      {/* Cards de resumo (mesma posição/estilo da antiga aba Saldo) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10"><CalendarDays size={20} className="text-primary" /></div>
          <div>
            <p className="text-2xl font-bold text-primary">{totalEsc}</p>
            <p className="text-xs text-muted-foreground">Dias escalados no mês</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-destructive/10"><CalendarOff size={20} className="text-destructive" /></div>
          <div>
            <p className="text-2xl font-bold text-destructive">{totalFol}</p>
            <p className="text-xs text-muted-foreground">Dias de folga no mês</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-accent/10"><Wallet size={20} className="text-accent-foreground" /></div>
          <div>
            <p className="text-2xl font-bold">{fmt(totalSaldo)}</p>
            <p className="text-xs text-muted-foreground">Saldo atual (selecionados)</p>
          </div>
        </div>
      </div>

      {/* Filtros (mesmo padrão da aba Profissionais) */}
      <div className="flex flex-wrap items-center gap-3 bg-card rounded-xl border border-border p-3 print:hidden">
        <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
          <SelectTrigger className="w-[100px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>

        {showUnitFilter && (
          <Select value={filterUnit} onValueChange={v => { setFilterUnit(v); setFilterEmp('all'); }}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Unidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Unidades</SelectItem>
              {units.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {showCategoryFilter && (
          <Select value={filterCat} onValueChange={v => { setFilterCat(v); setFilterEmp('all'); }}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Categorias</SelectItem>
              {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Select value={filterEmp} onValueChange={setFilterEmp}>
          <SelectTrigger className="w-[200px] h-9"><SelectValue placeholder="Profissional" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Profissionais</SelectItem>
            {employees
              .filter(e => (filterUnit === 'all' || e.unit_id === filterUnit) && (filterCat === 'all' || e.category_id === filterCat))
              .map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filterKind} onValueChange={v => setFilterKind(v as any)}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Escalas e Folgas</SelectItem>
            <SelectItem value="escala">Só Escalas</SelectItem>
            <SelectItem value="folga">Só Folgas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        Referência: {MONTHS[month]} / {year} — {entries.length} lançamento(s)
      </p>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : (
        <>
          {/* Lançamentos do mês */}
          <div className="bg-card rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-muted/50">
                <tr>
                  <th className={head}>Data</th>
                  <th className={head}>Profissional</th>
                  <th className={head}>Categoria</th>
                  <th className={head}>Unidade</th>
                  <th className={head}>Tipo</th>
                  <th className={head}>Turno</th>
                  <th className={head}>Créditos</th>
                  <th className={head}>Observação</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr><td colSpan={8} className={`${cell} text-center text-muted-foreground py-6`}>Nenhum lançamento no período.</td></tr>
                ) : entries.map(en => {
                  const emp = empMap.get(en.employeeId);
                  return (
                    <tr key={en.key}>
                      <td className={`${cell} whitespace-nowrap`}>{fmtDate(en.date)} <span className="text-muted-foreground text-xs">({weekday(en.date)})</span></td>
                      <td className={cell}>{emp?.name ?? '—'}</td>
                      <td className={cell}>{catName(emp?.category_id ?? null)}</td>
                      <td className={cell}>{unitName(emp?.unit_id ?? null)}</td>
                      <td className={`${cell} font-medium ${en.kind === 'escala' ? 'text-primary' : 'text-destructive'}`}>
                        {en.kind === 'escala' ? 'Escala' : 'Folga'}
                      </td>
                      <td className={cell}>{en.shift}</td>
                      <td className={`${cell} whitespace-nowrap`}>
                        {en.credit == null ? '—' : en.credit > 0 ? `+${fmt(en.credit)}` : fmt(en.credit)}
                      </td>
                      <td className={cell}>{en.obs || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Resumo por profissional */}
          <div className="bg-card rounded-xl border border-border overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-muted/50">
                <tr>
                  <th className={head}>Profissional</th>
                  <th className={head}>Categoria</th>
                  <th className={head}>Unidade</th>
                  <th className={`${head} text-center`}>Dias escalados</th>
                  <th className={`${head} text-center`}>Dias de folga</th>
                  <th className={`${head} text-center`}>Saldo atual</th>
                </tr>
              </thead>
              <tbody>
                {summary.length === 0 ? (
                  <tr><td colSpan={6} className={`${cell} text-center text-muted-foreground py-6`}>Nenhum profissional encontrado.</td></tr>
                ) : summary.map(r => (
                  <tr key={r.emp.id}>
                    <td className={cell}>{r.emp.name}</td>
                    <td className={cell}>{catName(r.emp.category_id)}</td>
                    <td className={cell}>{unitName(r.emp.unit_id)}</td>
                    <td className={`${cell} text-center`}>{r.esc}</td>
                    <td className={`${cell} text-center`}>{r.fol}</td>
                    <td className={`${cell} text-center font-semibold`}>{r.saldo > 0 ? `+${fmt(r.saldo)}` : fmt(r.saldo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
