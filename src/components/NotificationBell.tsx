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

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  link: string | null;
  created_at: string;
}

export function NotificationBell({ iconClassName }: { iconClassName?: string }) {
  const { user } = useAuthContext();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
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
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-auto p-0 text-xs text-primary hover:text-primary/80 transition-colors">
              Marcar como lidas
            </Button>
          )}
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
                    "text-left px-4 py-3 text-sm transition-all hover:bg-muted/60 border-b border-border/40 last:border-0",
                    !n.is_read ? "bg-primary/5" : "opacity-75"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={cn("font-medium", !n.is_read ? "text-foreground" : "text-muted-foreground")}>{n.title}</span>
                    {!n.is_read && <span className="h-2 w-2 mt-1.5 rounded-full bg-primary shrink-0 shadow-[0_0_8px_hsl(var(--primary))]" />}
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
    </Popover>
  );
}
