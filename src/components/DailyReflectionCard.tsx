import { useMemo, useState } from 'react';
import { getDailyReflection, dailyReflections, DailyReflection } from '@/data/dailyReflections';
import { Sparkles, Quote, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  className?: string;
}

export function DailyReflectionCard({ className }: Props) {
  const defaultReflection = useMemo(() => getDailyReflection(), []);
  const [current, setCurrent] = useState<DailyReflection>(defaultReflection);
  const [isRotating, setIsRotating] = useState(false);

  const handleNextQuote = () => {
    setIsRotating(true);
    setTimeout(() => {
      const currentIndex = dailyReflections.findIndex(r => r.quote === current.quote);
      const nextIndex = (currentIndex + 1) % dailyReflections.length;
      setCurrent(dailyReflections[nextIndex]);
      setIsRotating(false);
    }, 150);
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs transition-all ${className ?? ''}`}>
      {/* Decorative background accent */}
      <div className="absolute top-0 right-0 -mt-3 -mr-3 w-24 h-24 rounded-full bg-primary/5 blur-2xl pointer-events-none" />

      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Sparkles size={14} />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Reflexão do Dia
          </span>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted shrink-0"
          title="Ver outra mensagem"
          onClick={handleNextQuote}
        >
          <RefreshCw size={12} className={isRotating ? 'animate-spin' : ''} />
        </Button>
      </div>

      <div className="pl-1 sm:pl-2 border-l-2 border-primary/30 my-1">
        <p className="text-sm sm:text-base font-medium text-foreground italic leading-relaxed">
          "{current.quote}"
        </p>
        <div className="flex flex-wrap items-center gap-1.5 mt-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground/90">{current.author}</span>
          {current.role && (
            <>
              <span>•</span>
              <span className="text-[11px] opacity-80">{current.role}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
