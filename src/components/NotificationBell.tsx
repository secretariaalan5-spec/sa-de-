import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { Bell } from 'lucide-react';
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
import { Send, Loader2, Megaphone, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
  sender_id?: string;
  batch_id?: string;
}

export function NotificationBell({ iconClassName }: { iconClassName?: string }) {
  const { user, isAdmin, isRH, roleInfo } = useAuthContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  
  // Admin Send Notification State
  const [sendOpen, setSendOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const navigate = useNavigate();

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(30);
    
    if (data) setNotifications(data);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useDataSubscription(['notifications'], load);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  useEffect(() => {
    // Atualiza o contador de mensagens no ícone do aplicativo (PWA App Badge/Taskbar)
    if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator && 'clearAppBadge' in navigator) {
      try {
        if (unreadCount > 0) {
          (navigator as any).setAppBadge(unreadCount).catch(() => {});
        } else {
          (navigator as any).clearAppBadge().catch(() => {});
        }
      } catch (e) {}
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
    e.stopPropagation(); // Evita marcar como lida e redirecionar ao excluir
    if (!user) return;

    if (n.sender_id === user.id && n.batch_id) {
      // Exclui o broadcast inteiro para todos que o receberam (global delete)
      await supabase.from('notifications').delete().eq('batch_id', n.batch_id);
      toast.success('Comunicado apagado para todos.');
    } else {
      // Exclui apenas a cópia local do usuário
      await supabase.from('notifications').delete().eq('id', n.id);
    }
    load();
  };

  const handleSendToManagers = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Preencha título e mensagem.');
      return;
    }
    setSending(true);
    try {
      const { data: managers } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('team_id', roleInfo?.team_id)
        .eq('role', 'unit_manager');

      if (!managers || managers.length === 0) {
        toast.info('Nenhum gerente encontrado.');
        setSending(false);
        return;
      }

      // Evita duplicação dedupando unit_managers se um user tiver a role mais de uma vez na mesma team
      const uniqueManagerIds = Array.from(new Set(managers.map(m => m.user_id)));

      // O admin deve receber uma cópia no seu painel para poder rastrear o aviso e apagá-lo globalmente
      if (!uniqueManagerIds.includes(user.id)) {
        uniqueManagerIds.unshift(user.id);
      }

      const batchId = crypto.randomUUID();

      const payload = uniqueManagerIds.map(userId => ({
        user_id: userId,
        team_id: roleInfo?.team_id,
        title: title.trim(),
        message: message.trim(),
        link: null,
        sender_id: user.id,
        batch_id: batchId
      }));

      const { error } = await supabase.from('notifications').insert(payload);
      if (error) throw error;
      
      // Send external Push Notification using OneSignal via Edge Function
      supabase.functions.invoke('send-push-notification', {
        body: {
          user_ids: uniqueManagerIds,
          title: title.trim(),
          message: message.trim(),
        }
      }).catch(console.error);
      
      toast.success(`Comunicado enviado para ${uniqueManagerIds.length} gerente(s).`);
      setTitle('');
      setMessage('');
      setSendOpen(false);
    } catch (e: any) {
      toast.error('Erro ao enviar: ' + e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn("relative p-1.5 transition-colors flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/5", iconClassName)}>
          <Bell className="h-[22px] w-[22px]" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive border-[2px] border-background"></span>
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-0 shadow-2xl border-border/50 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
          <h4 className="font-semibold text-sm">Notificações {unreadCount > 0 && <span className="ml-1 text-xs bg-destructive text-destructive-foreground px-1.5 py-0.5 rounded-full">{unreadCount}</span>}</h4>
          <div className="flex items-center gap-2">
            {(isAdmin || isRH) && (
              <Button variant="outline" size="sm" onClick={() => setSendOpen(true)} className="h-6 px-2 text-[10px] gap-1">
                <Megaphone size={12} /> Aviso
              </Button>
            )}
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-auto p-0 text-xs text-primary hover:text-primary/80 transition-colors">
                Marcar lidas
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[360px] bg-card">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground space-y-2">
              <Bell className="h-8 w-8 opacity-20" />
              <p className="text-sm">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => markAsRead(n.id, n.link)}
                  className={cn(
                    "group relative text-left px-4 py-3 text-sm transition-all hover:bg-muted/60 border-b border-border/40 last:border-0",
                    !n.is_read ? "bg-primary/5" : "opacity-75"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn("font-medium", !n.is_read ? "text-foreground" : "text-muted-foreground")}>{n.title}</span>
                    <div className="flex items-center gap-2">
                      {!n.is_read && <span className="h-2 w-2 mt-1.5 rounded-full bg-primary shrink-0 shadow-[0_0_8px_hsl(var(--primary))]" />}
                      {n.sender_id === user?.id && n.batch_id && (
                        <button 
                          onClick={(e) => deleteNotification(n, e)}
                          className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md transition-colors opacity-0 group-hover:opacity-100"
                          title="Apagar aviso para todos"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-muted-foreground text-xs mt-1 leading-snug">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground/50 mt-2 font-mono">
                    {new Date(n.created_at).toLocaleString('pt-BR')}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>

      <Dialog open={sendOpen} onOpenChange={setSendOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-primary" />
              Comunicado aos Gerentes
            </DialogTitle>
            <DialogDescription>
              Envie um alerta que aparecerá no ícone de notificações (sino) de todos os Gerentes de Unidade.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Assunto</Label>
              <Input
                placeholder="Ex: Prazos de fechamento"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={50}
              />
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                placeholder="Digite o aviso para as chefias..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[100px] resize-none"
                maxLength={300}
              />
            </div>
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
