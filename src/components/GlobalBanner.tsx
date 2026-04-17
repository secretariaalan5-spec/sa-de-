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

  const banner = banners[0]; // Show one at a time to keep focus
  const isCritical = banner?.priority === 'critical';
  const isWarning = banner.priority === 'warning';

  const themeColors = {
    bg: isCritical ? "bg-red-600" : isWarning ? "bg-orange-500" : "bg-[#1E5BF0]",
    border: isCritical ? "border-red-400" : isWarning ? "border-orange-300" : "border-[#4DA8F5]",
    text: isCritical ? "text-red-600" : isWarning ? "text-orange-600" : "text-[#1E5BF0]",
    button: isCritical ? "bg-red-600 hover:bg-red-700" : isWarning ? "bg-orange-500 hover:bg-orange-600" : "bg-[#1E5BF0] hover:bg-blue-700",
  };

  const Icon = isCritical ? AlertCircle : isWarning ? AlertTriangle : Megaphone;

  return (
    <div className={cn("fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-500", themeColors.bg)}>
      {/* Background watermark effect */}
      <div className="absolute inset-0 opacity-10 pointer-events-none flex flex-wrap items-center justify-center overflow-hidden">
        {Array.from({ length: 40 }).map((_, i) => (
          <span key={i} className="text-white font-black text-5xl sm:text-7xl m-2 sm:m-4 tracking-tighter whitespace-nowrap select-none opacity-40">
            {isCritical ? 'URGENTE' : isWarning ? 'ATENÇÃO' : 'COMUNICADO'}
          </span>
        ))}
      </div>

      {/* Card Overlay */}
      <div className={cn("relative bg-white w-full max-w-md rounded-[32px] sm:rounded-[40px] p-8 sm:p-10 shadow-2xl flex flex-col items-center text-center z-10 border-[6px]", themeColors.border)}>
        
        {/* Top Badge with Icon */}
        <div className="absolute -top-14 left-1/2 -translate-x-1/2">
          <div className={cn("rounded-full p-5 border-[8px] border-white shadow-xl", themeColors.bg)}>
             <Icon size={44} className="text-white drop-shadow-md" />
          </div>
        </div>

        <div className="mt-10 mb-6 w-full">
          <h2 className={cn("text-[26px] sm:text-3xl font-black uppercase tracking-tighter leading-none break-words", themeColors.text)}>
            {banner.title || "COMUNICADO IMPORTANTE"}
          </h2>
        </div>

        <div className="w-full max-h-[40vh] overflow-y-auto custom-scrollbar mb-8">
          <p className="text-slate-600 font-medium text-[15px] sm:text-[17px] leading-relaxed whitespace-pre-wrap">
            {banner.message}
          </p>
        </div>

        <Button 
          onClick={() => dismiss(banner.id)}
          className={cn("w-full rounded-full h-14 text-lg font-bold text-white shadow-lg hover:shadow-xl transition-all active:scale-95", themeColors.button)}
        >
          Ciente, Dispensar
        </Button>

        <div className="mt-8 flex flex-col items-center gap-2">
          <img src={logoSaude} alt="Saúde+" className="h-10 w-10 rounded-xl grayscale opacity-70" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Saúde+ Escalas</span>
        </div>
      </div>
    </div>
  );
}
