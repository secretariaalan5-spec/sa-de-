import { useMemo, useState, useEffect } from 'react';
import { getDailyReflection, DailyReflection } from '@/data/dailyReflections';
import { Sparkles, X, HeartHandshake, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  className?: string;
}

export function DailyReflectionCard({ className }: Props) {
  const getTodayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const todayStr = getTodayStr();
  const [isDismissed, setIsDismissed] = useState<boolean>(() => {
    return localStorage.getItem('saude_daily_reflection_date') === todayStr;
  });

  const [closing, setClosing] = useState(false);
  const reflection = useMemo<DailyReflection>(() => getDailyReflection(), []);

  const handleDismiss = () => {
    setClosing(true);
    setTimeout(() => {
      localStorage.setItem('saude_daily_reflection_date', todayStr);
      setIsDismissed(true);
    }, 250);
  };

  if (isDismissed) {
    return null;
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-card to-primary/5 p-4 sm:p-5 shadow-sm transition-all duration-300 animate-in fade-in slide-in-from-top-2 ${
        closing ? 'opacity-0 -translate-y-2' : 'opacity-100 translate-y-0'
      } ${className ?? ''}`}
    >
      {/* Balão Pointer / Tag */}
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-semibold">
          <Sparkles size={13} className="text-primary animate-pulse" />
          <span>Reflexão do Dia</span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-background/80 rounded-full shrink-0"
          title="Fechar mensagem de hoje"
          onClick={handleDismiss}
        >
          <X size={15} />
        </Button>
      </div>

      {/* Conteúdo da Citação */}
      <div className="relative pl-3 border-l-2 border-primary/40 my-2">
        <p className="text-sm sm:text-base font-medium text-foreground italic leading-relaxed">
          "{reflection.quote}"
        </p>
        <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{reflection.author}</span>
          {reflection.role && (
            <>
              <span>•</span>
              <span className="text-[11px] opacity-80">{reflection.role}</span>
            </>
          )}
        </div>
      </div>

      {/* Rodapé do Balão com Ação Rápida */}
      <div className="flex items-center justify-between gap-2 pt-2.5 mt-2 border-t border-border/50 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <HeartHandshake size={14} className="text-primary/70 shrink-0" />
          <span>Desejamos um excelente dia de trabalho à toda a equipe!</span>
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-7 px-3 text-xs gap-1.5 border-primary/30 hover:bg-primary/10 hover:text-primary rounded-lg font-medium ml-auto"
          onClick={handleDismiss}
        >
          <Check size={12} /> Entendido, fechar
        </Button>
      </div>
    </div>
  );
}
