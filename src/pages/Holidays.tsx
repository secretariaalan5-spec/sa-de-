/**
 * Gerenciamento de Feriados — Admins cadastram feriados para cálculo de créditos.
 */
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useDataSubscription } from '@/hooks/useDataSubscription';
import { useAuthContext } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, PartyPopper, CalendarHeart, Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Holiday {
  id: string;
  date: string;
  name: string;
  created_at: string;
}

// Brazilian national holidays (fixed dates only)
const BRAZILIAN_NATIONAL_HOLIDAYS: { month: number; day: number; name: string }[] = [
  { month: 1, day: 1, name: 'Confraternização Universal' },
  { month: 4, day: 21, name: 'Tiradentes' },
  { month: 5, day: 1, name: 'Dia do Trabalho' },
  { month: 9, day: 7, name: 'Independência do Brasil' },
  { month: 10, day: 12, name: 'Nossa Senhora Aparecida' },
  { month: 11, day: 2, name: 'Finados' },
  { month: 11, day: 15, name: 'Proclamação da República' },
  { month: 12, day: 25, name: 'Natal' },
];

export default function Holidays() {
  const { roleInfo, isAdmin } = useAuthContext();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const teamId = roleInfo?.team_id;
    if (!teamId) return;
    const { data } = await supabase
      .from('holidays')
      .select('*')
      .eq('team_id', teamId)
      .order('date', { ascending: true });
    setHolidays(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [roleInfo?.team_id]);
  useDataSubscription(['holidays'], load);

  const currentYear = new Date().getFullYear();

  const handleAdd = async () => {
    if (!newDate || !newName.trim()) {
      toast.error('Preencha a data e o nome do feriado.');
      return;
    }
    if (!roleInfo?.team_id) return;

    const { error } = await supabase.from('holidays').insert({
      team_id: roleInfo.team_id,
      date: newDate,
      name: newName.trim(),
    });

    if (error) {
      if (error.code === '23505') {
        toast.error('Já existe um feriado cadastrado nesta data.');
      } else {
        toast.error(error.message || 'Erro ao cadastrar feriado.');
      }
      return;
    }

    toast.success(`Feriado "${newName}" cadastrado!`);
    setOpen(false);
    setNewDate('');
    setNewName('');
    load();
  };

  const handleDelete = async (id: string, name: string) => {
    const { error } = await supabase.from('holidays').delete().eq('id', id);
    if (error) { toast.error('Erro ao remover feriado.'); return; }
    toast.success(`Feriado "${name}" removido.`);
    load();
  };

  const handleSeedNational = async () => {
    if (!roleInfo?.team_id) return;

    const year = currentYear;
    const inserts = BRAZILIAN_NATIONAL_HOLIDAYS.map(h => ({
      team_id: roleInfo.team_id,
      date: `${year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`,
      name: h.name,
    }));

    const { error } = await supabase.from('holidays').upsert(inserts, { onConflict: 'team_id,date' });
    if (error) {
      toast.error(error.message || 'Erro ao importar feriados.');
      return;
    }

    toast.success(`Feriados nacionais de ${year} importados!`);
    load();
  };

  const handleSeedNextYear = async () => {
    if (!roleInfo?.team_id) return;

    const year = currentYear + 1;
    const inserts = BRAZILIAN_NATIONAL_HOLIDAYS.map(h => ({
      team_id: roleInfo.team_id,
      date: `${year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`,
      name: h.name,
    }));

    const { error } = await supabase.from('holidays').upsert(inserts, { onConflict: 'team_id,date' });
    if (error) {
      toast.error(error.message || 'Erro ao importar feriados.');
      return;
    }

    toast.success(`Feriados nacionais de ${year} importados!`);
    load();
  };

  const filtered = holidays.filter(h =>
    h.name.toLowerCase().includes(search.toLowerCase()) ||
    new Date(h.date + 'T12:00:00').toLocaleDateString('pt-BR').includes(search)
  );

  // Group by year
  const grouped = useMemo(() => {
    const map: Record<string, Holiday[]> = {};
    filtered.forEach(h => {
      const year = h.date.substring(0, 4);
      if (!map[year]) map[year] = [];
      map[year].push(h);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
  const getDayOfWeek = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' });

  // When user picks a date and it matches a national holiday, auto-fill name
  const handleDateChange = (date: string) => {
    setNewDate(date);
    if (date) {
      const d = new Date(date + 'T12:00:00');
      const found = BRAZILIAN_NATIONAL_HOLIDAYS.find(h => h.month === d.getMonth() + 1 && h.day === d.getDate());
      if (found && !newName) {
        setNewName(found.name);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarHeart size={24} className="text-primary" />
            Feriados
          </h1>
          <p className="text-muted-foreground text-sm">
            Feriados contam como final de semana para créditos de escala (×2)
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleSeedNational} className="gap-2 text-sm">
              <Sparkles size={14} />
              Importar {currentYear}
            </Button>
            <Button variant="outline" onClick={handleSeedNextYear} className="gap-2 text-sm">
              <Sparkles size={14} />
              Importar {currentYear + 1}
            </Button>
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus size={16} /> Novo Feriado
            </Button>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
        <Input
          placeholder="Buscar feriado..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : grouped.length === 0 ? (
        <div className="empty-state py-12">
          <PartyPopper className="mx-auto mb-3 text-muted-foreground" size={40} />
          <p className="text-muted-foreground">Nenhum feriado cadastrado</p>
          {isAdmin && (
            <p className="text-xs text-muted-foreground mt-2">
              Clique em "Importar {currentYear}" para adicionar os feriados nacionais brasileiros automaticamente.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([year, items]) => (
            <div key={year}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                <PartyPopper size={14} />
                {year} <Badge variant="secondary" className="text-[10px]">{items.length} feriado{items.length !== 1 ? 's' : ''}</Badge>
              </h3>
              <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="divide-y divide-border">
                  {items.map(h => (
                    <div key={h.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex flex-col items-center justify-center">
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-300 capitalize">
                            {getDayOfWeek(h.date)}
                          </span>
                          <span className="text-sm font-bold text-amber-800 dark:text-amber-200">
                            {new Date(h.date + 'T12:00:00').getDate()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{h.name}</p>
                          <p className="text-xs text-muted-foreground">{fmtDate(h.date)}</p>
                        </div>
                      </div>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleDelete(h.id, h.name)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Holiday Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Feriado</DialogTitle>
            <DialogDescription>
              Cadastre um feriado nacional, estadual ou municipal. 
              Escalas nestes dias geram créditos ×2 (como finais de semana).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input
                type="date"
                value={newDate}
                onChange={e => handleDateChange(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nome do Feriado</Label>
              <Input
                placeholder="Ex: Tiradentes, Dia do Trabalho..."
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
            </div>
            <Button onClick={handleAdd} className="w-full" disabled={!newDate || !newName.trim()}>
              Cadastrar Feriado
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
