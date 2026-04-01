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
  const { roleInfo } = useAuthContext();
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [empRes, credRes, catRes, unitRes] = await Promise.all([
      supabase.from('employees').select('id, name, category_id, unit_id').eq('active', true),
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
            <p className="text-2xl font-bold text-primary">{totalExtras}</p>
            <p className="text-xs text-muted-foreground">Créditos ganhos</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-destructive/10">
            <TrendingDown size={20} className="text-destructive" />
          </div>
          <div>
            <p className="text-2xl font-bold text-destructive">{totalUsed}</p>
            <p className="text-xs text-muted-foreground">Créditos usados</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-accent/10">
            <ArrowUpDown size={20} className="text-accent-foreground" />
          </div>
          <div>
            <p className="text-2xl font-bold">{totalBalance}</p>
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
        <div className="page-card overflow-x-auto">
          <table className="schedule-table w-full">
            <thead>
              <tr>
                <th className="text-left">Profissional</th>
                <th className="text-left hidden sm:table-cell">Categoria</th>
                <th className="text-left hidden sm:table-cell">Unidade</th>
                <th className="text-center">Extras</th>
                <th className="text-center">Usados</th>
                <th className="text-center">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(row => (
                <tr key={row.employee.id}>
                  <td className="font-medium">{row.employee.name}</td>
                  <td className="hidden sm:table-cell text-muted-foreground text-sm">{row.categoryName}</td>
                  <td className="hidden sm:table-cell text-muted-foreground text-sm">{row.unitName}</td>
                  <td className="text-center">
                    <Badge variant="secondary" className="font-mono">+{row.extras}</Badge>
                  </td>
                  <td className="text-center">
                    <Badge variant="secondary" className="font-mono text-destructive">-{row.used}</Badge>
                  </td>
                  <td className="text-center">
                    <Badge
                      variant={row.balance > 0 ? 'default' : row.balance < 0 ? 'destructive' : 'secondary'}
                      className="font-mono font-bold"
                    >
                      {row.balance}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
