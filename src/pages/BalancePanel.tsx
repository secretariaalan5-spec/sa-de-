/**
 * Painel de Saldo de Folgas — mostra créditos por profissional.
 */
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useDataSubscription } from '@/hooks/useDataSubscription';
import { useAuthContext } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Wallet, Search, TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  category_id: string | null;
  unit_id: string | null;
}

interface Credit {
  employee_id: string;
  amount: number;
  origin: string;
}

interface Category { id: string; name: string; color: string; }
interface Unit { id: string; name: string; }

interface BalanceRow {
  employee: Employee;
  extras: number;
  used: number;
  balance: number;
  categoryName: string;
  unitName: string;
}

export default function BalancePanel() {
  const { roleInfo, isAdmin, isChief, isManager, isRH } = useAuthContext();
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    let employeesQuery = supabase.from('employees').select('id, name, category_id, unit_id').eq('active', true);
    if (isChief && !isAdmin && !isRH && roleInfo?.category_ids?.length) {
      employeesQuery = employeesQuery.in('category_id', roleInfo.category_ids);
    }
    if (isManager && !isAdmin && !isRH && roleInfo?.unit_id) {
      employeesQuery = employeesQuery.eq('unit_id', roleInfo.unit_id);
    }

    const [empRes, credRes, catRes, unitRes] = await Promise.all([
      employeesQuery,
      supabase.from('leave_credits').select('employee_id, amount, origin'),
      supabase.from('categories').select('id, name, color'),
      supabase.from('units').select('id, name'),
    ]);

    const employees: Employee[] = empRes.data ?? [];
    const credits: Credit[] = credRes.data ?? [];
    const categories: Category[] = catRes.data ?? [];
    const units: Unit[] = unitRes.data ?? [];

    const catMap = Object.fromEntries(categories.map(c => [c.id, c]));
    const unitMap = Object.fromEntries(units.map(u => [u.id, u]));

    const balances: BalanceRow[] = employees.map(emp => {
      const empCredits = credits.filter(c => c.employee_id === emp.id);
      const extras = empCredits.filter(c => c.amount > 0).reduce((s, c) => s + c.amount, 0);
      const used = Math.abs(empCredits.filter(c => c.amount < 0).reduce((s, c) => s + c.amount, 0));
      return {
        employee: emp,
        extras,
        used,
        balance: extras - used,
        categoryName: emp.category_id ? catMap[emp.category_id]?.name ?? '—' : '—',
        unitName: emp.unit_id ? unitMap[emp.unit_id]?.name ?? '—' : '—',
      };
    });

    balances.sort((a, b) => b.balance - a.balance);
    setRows(balances);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  useDataSubscription(['employees', 'leave_credits', 'categories', 'units'], load);

  const filtered = rows.filter(r =>
    r.employee.name.toLowerCase().includes(search.toLowerCase()) ||
    r.categoryName.toLowerCase().includes(search.toLowerCase()) ||
    r.unitName.toLowerCase().includes(search.toLowerCase())
  );

  const fmtCredit = (n: number) => n % 1 === 0 ? n.toString() : n.toFixed(1).replace('.', ',');

  const totalExtras = rows.reduce((s, r) => s + r.extras, 0);
  const totalUsed = rows.reduce((s, r) => s + r.used, 0);
  const totalBalance = rows.reduce((s, r) => s + r.balance, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet size={24} className="text-primary" />
            Saldo de Folgas
          </h1>
          <p className="text-muted-foreground text-sm">Créditos de folga por profissional</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <TrendingUp size={20} className="text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-primary">{fmtCredit(totalExtras)}</p>
            <p className="text-xs text-muted-foreground">Créditos ganhos</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-destructive/10">
            <TrendingDown size={20} className="text-destructive" />
          </div>
          <div>
            <p className="text-2xl font-bold text-destructive">{fmtCredit(totalUsed)}</p>
            <p className="text-xs text-muted-foreground">Créditos usados</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-accent/10">
            <ArrowUpDown size={20} className="text-accent-foreground" />
          </div>
          <div>
            <p className="text-2xl font-bold">{fmtCredit(totalBalance)}</p>
            <p className="text-xs text-muted-foreground">Saldo total</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <Input
          placeholder="Buscar profissional, categoria ou unidade..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state py-12">
          <Wallet className="mx-auto mb-3 text-muted-foreground" size={40} />
          <p className="text-muted-foreground">Nenhum profissional encontrado</p>
        </div>
      ) : (
      <>
        {/* Mobile View: Cards */}
        <div className="space-y-3 sm:hidden mt-2">
          {filtered.map(row => (
            <div key={row.employee.id} className="page-card p-3 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-bold text-foreground">{row.employee.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{row.categoryName} • {row.unitName}</p>
                </div>
                <Badge
                  variant={row.balance > 0 ? 'default' : row.balance < 0 ? 'destructive' : 'secondary'}
                  className="font-mono font-bold"
                >
                  {row.balance > 0 ? `+${fmtCredit(row.balance)}` : fmtCredit(row.balance)}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                <div className="bg-primary/5 p-2 rounded-lg flex flex-col items-center">
                  <span className="text-[9px] text-primary uppercase font-bold tracking-tighter">Ganhos</span>
                  <span className="text-sm font-mono font-bold text-primary">+{fmtCredit(row.extras)}</span>
                </div>
                <div className="bg-destructive/5 p-2 rounded-lg flex flex-col items-center">
                  <span className="text-[9px] text-destructive uppercase font-bold tracking-tighter">Usados</span>
                  <span className="text-sm font-mono font-bold text-destructive">-{fmtCredit(row.used)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden sm:block bg-card rounded-xl border border-border shadow-sm overflow-hidden mt-2">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-5 py-4 font-semibold">Profissional</th>
                  <th className="px-5 py-4 font-semibold">Categoria</th>
                  <th className="px-5 py-4 font-semibold">Unidade</th>
                  <th className="px-5 py-4 font-semibold text-center">Extras</th>
                  <th className="px-5 py-4 font-semibold text-center">Usados</th>
                  <th className="px-5 py-4 font-semibold text-center">Saldo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(row => (
                  <tr key={row.employee.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-foreground">{row.employee.name}</td>
                    <td className="px-5 py-3.5 text-muted-foreground text-sm">{row.categoryName}</td>
                    <td className="px-5 py-3.5 text-muted-foreground text-sm">{row.unitName}</td>
                    <td className="px-5 py-3.5 text-center">
                      <Badge variant="secondary" className="font-mono bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary">+{fmtCredit(row.extras)}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <Badge variant="secondary" className="font-mono bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive">-{fmtCredit(row.used)}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <Badge
                        variant={row.balance > 0 ? 'default' : row.balance < 0 ? 'destructive' : 'secondary'}
                        className="font-mono font-bold shadow-none"
                      >
                        {row.balance > 0 ? `+${fmtCredit(row.balance)}` : fmtCredit(row.balance)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </>
      )}
    </div>
  );
}
