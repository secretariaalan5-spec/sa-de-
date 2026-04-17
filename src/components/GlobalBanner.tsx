import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useAuthContext } from '@/contexts/AuthContext';
import { useDataSubscription } from '@/hooks/useDataSubscription';
import { X, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface BannerNotification {
  id: string;
  title: string;
  message: string;
  priority: string;
}

export function GlobalBanner() {
  const { user } = useAuthContext();
  const [banners, setBanners] = useState<BannerNotification[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('id, title, message, priority')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .eq('is_global_banner', true)
      .order('created_at', { ascending: false });
    
    if (data) setBanners(data);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useDataSubscription(['notifications'], (payload?: any) => {
    load();
  });

  const dismiss = async (id: string) => {
    // optimistic update
    setBanners(prev => prev.filter(b => b.id !== id));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  if (banners.length === 0) return null;

  return (
    <div className="w-full flex flex-col no-print z-40 relative shadow-sm">
      {banners.map(banner => {
        const isCritical = banner.priority === 'critical';
        const isWarning = banner.priority === 'warning';
        return (
          <div 
            key={banner.id}
            className={cn(
              "relative w-full px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in slide-in-from-top-2",
              isCritical ? "bg-destructive text-destructive-foreground" : 
              isWarning ? "bg-orange-500 text-white" : 
              "bg-blue-600 text-white"
            )}
          >
            <div className="flex items-start sm:items-center gap-3">
              {isCritical ? <AlertCircle className="shrink-0 mt-0.5 sm:mt-0 h-5 w-5" /> : isWarning ? <AlertTriangle className="shrink-0 mt-0.5 sm:mt-0 h-5 w-5" /> : <Info className="shrink-0 mt-0.5 sm:mt-0 h-5 w-5" />}
              <div className="flex flex-col">
                <span className="font-bold text-sm leading-tight">{banner.title}</span>
                <span className="text-xs opacity-90 mt-0.5">{banner.message}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dismiss(banner.id)}
              className="shrink-0 h-7 px-2 hover:bg-black/20 text-current transition-colors ml-auto sm:ml-0"
            >
              <X size={14} className="mr-1.5" /> Dispensar
            </Button>
          </div>
        )
      })}
    </div>
  );
}
