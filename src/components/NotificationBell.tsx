import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { Bell, Calendar, FileCheck, FileX, Star, Trash2, Megaphone, Send, Loader2, ClipboardList, ArrowLeftRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { useAuthContext } from '@/contexts/AuthContext';
import { useDataSubscription } from '@/hooks/useDataSubscription';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { usePushNotifications } from '@/hooks/usePushNotifications';

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
  sender_id?: string;
  batch_id?: string;
  priority?: string;
  type?: string;
}

// ─── Ícone por tipo de notificação ───────────────────────────────────────────
function NotifIcon({ title, priority }: { title: string; priority?: string }) {
  const t = title?.toLowerCase() ?? '';

  if (t.includes('aprovada') || t.includes('aprovado'))
    return <FileCheck size={15} className="text-emerald-500 shrink-0 mt-0.5" />;
  if (t.includes('negada') || t.includes('negado'))
    return <FileX size={15} className="text-red-500 shrink-0 mt-0.5" />;
  if (t.includes('solicitação') || t.includes('folga'))
    return <ClipboardList size={15} className="text-amber-500 shrink-0 mt-0.5" />;
  if (t.includes('escala') && t.includes('registrada'))
    return <Calendar size={15} className="text-blue-500 shrink-0 mt-0.5" />;
  if (t.includes('escala') && t.includes('removida'))
    return <Trash2 size={15} className="text-red-400 shrink-0 mt-0.5" />;
  if (t.includes('crédito') || t.includes('saldo'))
    return <Star size={15} className="text-yellow-500 shrink-0 mt-0.5" />;
  if (t.includes('transfer'))
    return <ArrowLeftRight size={15} className="text-purple-500 shrink-0 mt-0.5" />;
  if (t.includes('comunicado') || t.includes('aviso'))
    return <Megaphone size={15} className="text-primary shrink-0 mt-0.5" />;

  return <Bell size={15} className="text-muted-foreground shrink-0 mt-0.5" />;
}

// ─── Cor da borda esquerda por prioridade ────────────────────────────────────
function priorityBorder(priority?: string) {
  if (priority === 'warning' || priority === 'critical') return 'border-l-2 border-l-amber-400';
  return '';
}

// ─── Formata data relativa ────────────────────────────────────────────────────
function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}m atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d atrás`;
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function NotificationBell({ iconClassName }: { iconClassName?: string }) {
  const { user, isAdmin, isRH, roleInfo } = useAuthContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const { showLocalPush } = usePushNotifications();

  // Admin Send Notification State
  const [sendOpen, setSendOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [isGlobalBanner, setIsGlobalBanner] = useState(false);
  const [priority, setPriority] = useState('info');
  const [targetAudience, setTargetAudience] = useState('managers');

  const navigate = useNavigate();

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(40);

    if (data) setNotifications(data);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useDataSubscription(['notifications'], (payload?: any) => {
    load();
    if (payload?.eventType === 'INSERT' && payload.new && user) {
      const n = payload.new;
      if (n.user_id === user.id && !n.is_read) {
        showLocalPush(
          n.title || 'Saúde+ Escalas',
          n.message || 'Você tem um novo aviso.',
          n.link || '/'
        );
      }
    }
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
      try {
        if (unreadCount > 0) {
          (navigator as any).setAppBadge(unreadCount).catch(() => {});
        } else {
          (navigator as any).clearAppBadge().catch(() => {});
        }
      } catch {}
    }
  }, [unreadCount]);

  const markAsRead = async (id: string, link: string | null) => {
    supabase.from('notifications').update({ is_read: true }).eq('id', id).then(() => load());
    setOpen(false);
    if (link) navigate(link);
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    load();
  };

  const deleteNotification = async (n: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    if (n.sender_id === user.id && n.batch_id) {
      await supabase.from('notifications').delete().eq('batch_id', n.batch_id);
      toast.success('Comunicado apagado para todos.');
    } else {
      await supabase.from('notifications').delete().eq('id', n.id);
    }
    load();
  };

  const handleSendToManagers = async () => {
    if (!title.trim() || !message.trim()) { toast.error('Preencha título e mensagem.'); return; }
    setSending(true);
    try {
      let query = supabase.from('user_roles').select('user_id').eq('team_id', roleInfo?.team_id);
      if (targetAudience === 'managers') query = query.eq('role', 'unit_manager');

      const { data: targets } = await query;
      if (!targets || targets.length === 0) { toast.info('Nenhum destinatário encontrado.'); setSending(false); return; }

      const uniqueTargetIds = Array.from(new Set(targets.map(m => m.user_id)));

      const { data: admins } = await supabase.from('user_roles').select('user_id').eq('team_id', roleInfo?.team_id).eq('role', 'admin');
      if (admins) admins.forEach(a => { if (!uniqueTargetIds.includes(a.user_id)) uniqueTargetIds.push(a.user_id); });
      if (!uniqueTargetIds.includes(user.id)) uniqueTargetIds.unshift(user.id);

      const batchId = crypto.randomUUID();
      const payload = uniqueTargetIds.map(userId => ({
        user_id: userId, team_id: roleInfo?.team_id,
        title: title.trim(), message: message.trim(),
        link: null, sender_id: user.id, batch_id: batchId,
        is_global_banner: isGlobalBanner,
        priority: isGlobalBanner ? priority : 'info',
        type: 'announcement',
      }));

      const { error } = await supabase.from('notifications').insert(payload);
      if (error) throw error;

      toast.success(`Comunicado enviado para ${uniqueTargetIds.length} pessoa(s).`);
      setTitle(''); setMessage(''); setIsGlobalBanner(false); setPriority('info'); setSendOpen(false);
    } catch (e: any) {
      toast.error('Erro ao enviar: ' + e.message);
    } finally { setSending(false); }
  };

  // ─── Agrupa notificações: não lidas primeiro, depois lidas ────────────────
  const unread = notifications.filter(n => !n.is_read);
  const read   = notifications.filter(n => n.is_read);

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (isOpen && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    }}>
      <PopoverTrigger asChild>
        <button className={cn("relative p-1.5 transition-colors flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/5", iconClassName)}>
          <Bell className="h-[22px] w-[22px]" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border-[2px] border-background" />
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[340px] p-0 shadow-2xl border-border/50 rounded-xl overflow-hidden">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            Notificações
            {unreadCount > 0 && (
              <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </h4>
          <div className="flex items-center gap-2">
            {(isAdmin || isRH) && (
              <Button variant="outline" size="sm" onClick={() => setSendOpen(true)} className="h-6 px-2 text-[10px] gap-1">
                <Megaphone size={11} /> Aviso
              </Button>
            )}
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-auto p-0 text-xs text-primary hover:text-primary/80">
                Marcar todas
              </Button>
            )}
          </div>
        </div>

        <ScrollArea className="h-[400px] bg-card">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-16 text-muted-foreground space-y-3">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                <Bell className="h-6 w-6 opacity-30" />
              </div>
              <p className="text-sm font-medium">Nenhuma notificação</p>
              <p className="text-xs text-muted-foreground/60 text-center px-6">
                Alertas de folgas, escalas e avisos aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="flex flex-col">
              {/* ── Não lidas ── */}
              {unread.length > 0 && (
                <>
                  <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 bg-muted/30">
                    Não lidas
                  </div>
                  {unread.map(n => (
                    <NotifRow
                      key={n.id}
                      n={n}
                      userId={user?.id}
                      onRead={markAsRead}
                      onDelete={deleteNotification}
                    />
                  ))}
                </>
              )}

              {/* ── Lidas ── */}
              {read.length > 0 && (
                <>
                  {unread.length > 0 && (
                    <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 bg-muted/30">
                      Anteriores
                    </div>
                  )}
                  {read.map(n => (
                    <NotifRow
                      key={n.id}
                      n={n}
                      userId={user?.id}
                      onRead={markAsRead}
                      onDelete={deleteNotification}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>

      {/* ── Dialog: Enviar Comunicado ── */}
      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" /> Enviar Comunicado
            </DialogTitle>
            <DialogDescription>Envie um alerta para a equipe.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Público Alvo</Label>
              <Select value={targetAudience} onValueChange={setTargetAudience}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="managers">Apenas Gerentes</SelectItem>
                  <SelectItem value="all">Todos da Equipe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Assunto</Label>
              <Input placeholder="Ex: Prazos de fechamento" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea placeholder="Digite o aviso para a equipe..." value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-[100px] resize-none" maxLength={300} />
            </div>
            <div className="flex items-center gap-2 border p-3 rounded-lg bg-muted/30">
              <Checkbox id="isGlobalBanner" checked={isGlobalBanner} onCheckedChange={(c) => setIsGlobalBanner(c === true)} />
              <div className="grid gap-1.5 leading-none">
                <Label htmlFor="isGlobalBanner" className="cursor-pointer font-medium text-sm">Exibir como Banner Global</Label>
                <p className="text-xs text-muted-foreground">Mantém a mensagem no topo da tela até que o usuário clique em Dispensar.</p>
              </div>
            </div>
            {isGlobalBanner && (
              <div className="space-y-2">
                <Label>Prioridade / Cor do Banner</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Informação (Azul)</SelectItem>
                    <SelectItem value="warning">Alerta (Laranja)</SelectItem>
                    <SelectItem value="critical">Crítico (Vermelho)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendOpen(false)} disabled={sending}>Cancelar</Button>
            <Button onClick={handleSendToManagers} disabled={sending} className="gap-2">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? 'Disparando...' : 'Disparar Aviso'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Popover>
  );
}

// ─── Componente de linha de notificação ───────────────────────────────────────
function NotifRow({
  n, userId, onRead, onDelete,
}: {
  n: Notification;
  userId?: string;
  onRead: (id: string, link: string | null) => void;
  onDelete: (n: Notification, e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={() => onRead(n.id, n.link)}
      className={cn(
        "group relative w-full text-left px-4 py-3 text-sm transition-all hover:bg-muted/60 border-b border-border/40 last:border-0",
        !n.is_read ? "bg-primary/5" : "opacity-70",
        priorityBorder(n.priority),
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Ícone por tipo */}
        <div className="mt-0.5 shrink-0">
          <NotifIcon title={n.title} priority={n.priority} />
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1.5">
            <span className={cn("font-semibold text-xs leading-tight", !n.is_read ? "text-foreground" : "text-muted-foreground")}>
              {n.title}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {!n.is_read && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 shadow-[0_0_6px_hsl(var(--primary))]" />
              )}
              {n.sender_id === userId && n.batch_id && (
                <button
                  onClick={(e) => onDelete(n, e)}
                  className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded transition-colors opacity-0 group-hover:opacity-100"
                  title="Apagar aviso para todos"
                >
                  <Trash2 size={11} />
                </button>
              )}
            </div>
          </div>
          <p className="text-muted-foreground text-[11px] mt-0.5 leading-snug line-clamp-2">{n.message}</p>
          <p className="text-[10px] text-muted-foreground/40 mt-1">{relativeTime(n.created_at)}</p>
        </div>
      </div>
    </button>
  );
}

