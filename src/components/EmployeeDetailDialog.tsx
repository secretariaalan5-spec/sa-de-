import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarDays, CalendarOff, ArrowRightLeft, Wallet, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  employeeId: string | null;
  employeeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Schedule { id: string; date: string; type: string; }
interface LeaveReq { id: string; status: string; days_requested: number; leave_dates: string[]; observations: string | null; created_at: string; decided_at: string | null; }
interface Transfer { id: string; from_unit_id: string | null; to_unit_id: string | null; transferred_at: string; }
interface Credit { amount: number; origin: string; created_at: string; }
interface Unit { id: string; name: string; }

export default function EmployeeDetailDialog({ employeeId, employeeName, open, onOpenChange }: Props) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [leaves, setLeaves] = useState<LeaveReq[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [credits, setCredits] = useState<Credit[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!employeeId || !open) return;
    setLoading(true);
    Promise.all([
      supabase.from('schedules').select('id, date, type').eq('employee_id', employeeId).order('date', { ascending: false }).limit(100),
      supabase.from('leave_requests').select('id, status, days_requested, leave_dates, observations, created_at, decided_at').eq('employee_id', employeeId).order('created_at', { ascending: false }),
      supabase.from('transfer_history').select('id, from_unit_id, to_unit_id, transferred_at').eq('employee_id', employeeId).order('transferred_at', { ascending: false }),
      supabase.from('leave_credits').select('amount, origin, created_at').eq('employee_id', employeeId).order('created_at', { ascending: false }),
      supabase.from('units').select('id, name'),
    ]).then(([s, l, t, c, u]) => {
      setSchedules(s.data ?? []);
      setLeaves(l.data ?? []);
      setTransfers(t.data ?? []);
      setCredits(c.data ?? []);
      setUnits(u.data ?? []);
      setLoading(false);
    });
  }, [employeeId, open]);

  const getUnitName = (id: string | null) => units.find(u => u.id === id)?.name ?? '—';

  const balance = credits.reduce((s, c) => s + c.amount, 0);
  const totalExtras = credits.filter(c => c.amount > 0).reduce((s, c) => s + c.amount, 0);
  const totalUsed = Math.abs(credits.filter(c => c.amount < 0).reduce((s, c) => s + c.amount, 0));

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
    pending: { label: 'Pendente', variant: 'secondary' },
    approved: { label: 'Aprovado', variant: 'default' },
    rejected: { label: 'Negado', variant: 'destructive' },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">{employeeName}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" size={24} /></div>
        ) : (
          <>
            {/* Balance summary */}
            <div className="grid grid-cols-3 gap-3 mb-2">
              <div className="rounded-xl border border-border p-3 text-center">
                <p className="text-lg font-bold text-primary">+{totalExtras}</p>
                <p className="text-[10px] text-muted-foreground">Créditos</p>
              </div>
              <div className="rounded-xl border border-border p-3 text-center">
                <p className="text-lg font-bold text-destructive">-{totalUsed}</p>
                <p className="text-[10px] text-muted-foreground">Usados</p>
              </div>
              <div className="rounded-xl border border-border p-3 text-center">
                <p className={cn('text-lg font-bold', balance > 0 ? 'text-primary' : balance < 0 ? 'text-destructive' : 'text-foreground')}>{balance}</p>
                <p className="text-[10px] text-muted-foreground">Saldo</p>
              </div>
            </div>

            <Tabs defaultValue="schedules">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="schedules" className="gap-1 text-xs"><CalendarDays size={12} /> Escalas ({schedules.length})</TabsTrigger>
                <TabsTrigger value="leaves" className="gap-1 text-xs"><CalendarOff size={12} /> Folgas ({leaves.length})</TabsTrigger>
                <TabsTrigger value="transfers" className="gap-1 text-xs"><ArrowRightLeft size={12} /> Transf. ({transfers.length})</TabsTrigger>
                <TabsTrigger value="credits" className="gap-1 text-xs"><Wallet size={12} /> Créditos ({credits.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="schedules" className="mt-3 max-h-[300px] overflow-y-auto">
                {schedules.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-6">Nenhuma escala registrada</p>
                ) : (
                  <div className="space-y-1">
                    {schedules.map(s => (
                      <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 text-sm">
                        <span>{fmtDate(s.date + 'T12:00:00')}</span>
                        <Badge variant={s.type === 'extra' ? 'default' : 'secondary'}>{s.type === 'extra' ? 'Extra' : 'Normal'}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="leaves" className="mt-3 max-h-[300px] overflow-y-auto">
                {leaves.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-6">Nenhum pedido de folga</p>
                ) : (
                  <div className="space-y-2">
                    {leaves.map(l => {
                      const cfg = statusLabels[l.status] ?? statusLabels.pending;
                      return (
                        <div key={l.id} className="p-3 rounded-lg border border-border space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{l.days_requested} dia(s)</span>
                            <Badge variant={cfg.variant}>{cfg.label}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Datas: {l.leave_dates?.map(d => fmtDate(d + 'T12:00:00')).join(', ')}
                          </p>
                          {l.observations && <p className="text-xs text-muted-foreground italic">"{l.observations}"</p>}
                          <p className="text-[10px] text-muted-foreground">Criado em {fmtDate(l.created_at)}{l.decided_at ? ` • Decidido em ${fmtDate(l.decided_at)}` : ''}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

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

              <TabsContent value="credits" className="mt-3 max-h-[300px] overflow-y-auto">
                {credits.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-6">Nenhum crédito registrado</p>
                ) : (
                  <div className="space-y-1">
                    {credits.map((c, i) => (
                      <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 text-sm">
                        <div>
                          <span className={cn('font-mono font-bold', c.amount > 0 ? 'text-primary' : 'text-destructive')}>
                            {c.amount > 0 ? '+' : ''}{c.amount}
                          </span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {c.origin === 'extra_shift' ? 'Escala extra' : c.origin === 'leave_used' ? 'Folga utilizada' : c.origin}
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">{fmtDate(c.created_at)}</span>
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
