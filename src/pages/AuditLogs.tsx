import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useAuthContext } from '@/contexts/AuthContext';
import { useDataSubscription } from '@/hooks/useDataSubscription';
import { ShieldAlert, Search, RefreshCw, Eye } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AuditLog {
  id: string;
  table_name: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  record_id: string;
  actor_id: string;
  changes: any;
  created_at: string;
  actorProfile?: { display_name: string };
}

export default function AuditLogs() {
  const { isAdmin } = useAuthContext();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('all');
  const [filterTable, setFilterTable] = useState('all');
  
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

  const loadLogs = async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`*, actorProfile:profiles(display_name)`)
        .order('created_at', { ascending: false })
        .limit(200);
      
      if (error) {
        console.error("Supabase Error fetching audit logs:", error);
      }
      setLogs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [isAdmin]);

  useDataSubscription(['audit_logs'], (payload) => {
    loadLogs();
  });

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <ShieldAlert size={64} className="text-destructive mb-4" />
        <h2 className="text-2xl font-bold">Acesso Negado</h2>
        <p className="text-muted-foreground mt-2">Você não possui permissão de Administrador para acessar a Caixa Preta de Auditoria.</p>
      </div>
    );
  }

  const filteredLogs = logs.filter(log => {
    const actorName = log.actorProfile?.display_name?.toLowerCase() || '';
    if (search && !actorName.includes(search.toLowerCase()) && !log.id.includes(search)) return false;
    if (filterAction !== 'all' && log.action !== filterAction) return false;
    if (filterTable !== 'all' && log.table_name !== filterTable) return false;
    return true;
  });

  const getActionColor = (action: string) => {
    switch(action) {
      case 'INSERT': return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'UPDATE': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'DELETE': return 'bg-red-500/10 text-red-600 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-600';
    }
  };

  const getTableNameText = (table: string) => {
    const names: Record<string, string> = {
      schedules: 'Escalas',
      employees: 'Profissionais',
      leave_requests: 'Pedidos de Folga',
      units: 'Unidades',
      categories: 'Categorias'
    };
    return names[table] || table;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 text-red-600 dark:text-red-500">
          <ShieldAlert size={24} /> Log de Auditoria
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Registros de segurança inalteráveis gerados automaticamente pelo Banco de Dados.</p>
      </div>

      <div className="flex flex-wrap gap-3 bg-card p-3 rounded-xl border border-border items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-2.5 text-muted-foreground" />
          <Input 
            placeholder="Buscar por ator..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pl-9 h-9" 
          />
        </div>
        
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Ação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Ações</SelectItem>
            <SelectItem value="INSERT">Inclusões</SelectItem>
            <SelectItem value="UPDATE">Edições</SelectItem>
            <SelectItem value="DELETE">Exclusões</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterTable} onValueChange={setFilterTable}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Tabela" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Qualquer Tabela</SelectItem>
            <SelectItem value="schedules">Escalas</SelectItem>
            <SelectItem value="leave_requests">Pedidos de Folga</SelectItem>
            <SelectItem value="employees">Profissionais</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="icon" className="h-9 w-9" onClick={loadLogs}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>

      <>
        {/* Mobile View: Cards */}
        <div className="space-y-3 sm:hidden mt-2">
          {loading && logs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Consultando caixa preta...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum log encontrado.</div>
          ) : (
            filteredLogs.map(log => (
              <div key={log.id} className="page-card p-3 space-y-3">
                <div className="flex justify-between items-start">
                  <Badge variant="outline" className={getActionColor(log.action)}>{log.action}</Badge>
                  <span className="text-[10px] text-muted-foreground font-mono">{format(new Date(log.created_at), "dd/MM/yyyy HH:mm")}</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{getTableNameText(log.table_name)}</p>
                  <p className="text-xs text-muted-foreground">Ator: {log.actorProfile?.display_name || 'Sistema'}</p>
                </div>
                <div className="pt-2 border-t flex justify-end">
                  <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setDetailLog(log)}>
                    <Eye size={14} /> Inspecionar
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden sm:block bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground border-b border-border">
                <tr>
                  <th className="px-5 py-4 font-semibold">Data/Hora</th>
                  <th className="px-5 py-4 font-semibold">Ação</th>
                  <th className="px-5 py-4 font-semibold">Módulo</th>
                  <th className="px-5 py-4 font-semibold">Ator (Quem fez)</th>
                  <th className="px-5 py-4 font-semibold text-right">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && logs.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground animate-pulse">Consultando caixa preta...</td></tr>
                ) : filteredLogs.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum log encontrado nos filtros.</td></tr>
                ) : (
                  filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-5 py-3.5 whitespace-nowrap text-muted-foreground font-mono text-xs">
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss")}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant="outline" className={getActionColor(log.action)}>
                          {log.action}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-foreground">
                        {getTableNameText(log.table_name)}
                      </td>
                      <td className="px-5 py-3.5">
                        {log.actorProfile?.display_name ? (
                          <span className="font-semibold text-foreground">{log.actorProfile.display_name}</span>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">Id: {log.actor_id || 'Sistema'}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex justify-end opacity-100 sm:opacity-50 sm:group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="sm" className="h-8 hover:bg-primary/10 hover:text-primary transition-colors text-xs" onClick={() => setDetailLog(log)}>
                            <Eye size={14} className="mr-1.5" /> Inspecionar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </>

      <Dialog open={!!detailLog} onOpenChange={(o) => !o && setDetailLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-red-500" />
              Inspeção Forense (Raw JSON)
            </DialogTitle>
          </DialogHeader>
          <div className="bg-zinc-950 p-4 rounded-lg overflow-hidden border border-zinc-800">
            <ScrollArea className="h-[400px]">
              <pre className="text-zinc-300 font-mono text-xs whitespace-pre-wrap word-break-all">
                {detailLog ? JSON.stringify(detailLog.changes, null, 2) : ''}
              </pre>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
