import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CalendarDays,
  User,
  Layers,
  Bell,
  ArrowRight,
  Check,
  X,
  Sparkles,
} from 'lucide-react';

export interface TourStep {
  targetId: string;
  title: string;
  badge: string;
  icon: typeof CalendarDays;
  description: string;
  preferredPosition: 'bottom' | 'top' | 'bottom-right';
}

const TOUR_STEPS: TourStep[] = [
  {
    targetId: 'tour-profile-card',
    title: 'Seu Perfil',
    badge: '1/4',
    icon: User,
    description: 'Toque na câmera para mudar sua foto e ver seus dados de lotação.',
    preferredPosition: 'bottom',
  },
  {
    targetId: 'tour-balance-card',
    title: 'Saldo de Folgas',
    badge: '2/4',
    icon: CalendarDays,
    description: 'Acompanhe seu Total Acumulado, Folgas Utilizadas e Saldo Livre.',
    preferredPosition: 'bottom',
  },
  {
    targetId: 'tour-tabs-bar',
    title: 'Navegação Simples',
    badge: '3/4',
    icon: Layers,
    description: '3 abas fáceis: Escalas, Folgas (com canceladas) e Extrato completo.',
    preferredPosition: 'top',
  },
  {
    targetId: 'tour-notifications',
    title: 'Avisos & Notificações',
    badge: '4/4',
    icon: Bell,
    description: 'Novas escalas e aprovações de folga chegam aqui no sininho.',
    preferredPosition: 'bottom-right',
  },
];

interface PortalOnboardingTourProps {
  open: boolean;
  onClose: () => void;
}

export default function PortalOnboardingTour({ open, onClose }: PortalOnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const step = TOUR_STEPS[currentStep];
  const isLast = currentStep === TOUR_STEPS.length - 1;
  const StepIcon = step?.icon || Sparkles;

  // Atualiza coordenadas do elemento alvo
  const updateRect = useCallback(() => {
    if (!step) return;
    const el = document.getElementById(step.targetId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [step]);

  useEffect(() => {
    if (!open) return;
    updateRect();

    const handleScrollOrResize = () => updateRect();
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [open, currentStep, updateRect]);

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isLast) {
      handleComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleComplete = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    localStorage.setItem('saude_portal_tour_completed', 'true');
    setCurrentStep(0);
    onClose();
  };

  // Cálculo da posição do balãozinho menor colado ao elemento
  const bubbleStyle = useMemo<React.CSSProperties>(() => {
    if (!targetRect) return { display: 'none' };

    const bubbleWidth = 260;
    const margin = 10;
    const pos = step.preferredPosition;

    if (pos === 'bottom-right') {
      const top = targetRect.bottom + margin;
      const right = Math.max(12, window.innerWidth - targetRect.right - 10);
      return {
        top: `${Math.max(10, top)}px`,
        right: `${right}px`,
        maxWidth: `${bubbleWidth}px`,
      };
    }

    if (pos === 'top') {
      const bottom = window.innerHeight - targetRect.top + margin;
      // Centraliza horizontalmente sobre o elemento
      const left = Math.max(
        12,
        Math.min(
          targetRect.left + targetRect.width / 2 - bubbleWidth / 2,
          window.innerWidth - bubbleWidth - 12
        )
      );
      return {
        bottom: `${Math.max(10, bottom)}px`,
        left: `${left}px`,
        maxWidth: `${bubbleWidth}px`,
      };
    }

    // Default: 'bottom'
    const top = targetRect.bottom + margin;
    const left = Math.max(
      12,
      Math.min(
        targetRect.left + targetRect.width / 2 - bubbleWidth / 2,
        window.innerWidth - bubbleWidth - 12
      )
    );
    return {
      top: `${Math.max(10, top)}px`,
      left: `${left}px`,
      maxWidth: `${bubbleWidth}px`,
    };
  }, [targetRect, step]);

  if (!open || !step) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans select-none animate-in fade-in duration-200">
      {/* Backdrop escurecido leve com fechamento ao tocar fora */}
      <div
        onClick={handleNext}
        className="absolute inset-0 bg-[#071326]/65 backdrop-blur-[1px] transition-opacity cursor-pointer"
      />

      {/* Destaque / Spotlight sobre a função */}
      {targetRect && (
        <div
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
          }}
          className="fixed rounded-[22px] pointer-events-none transition-all duration-200 ease-out z-50 ring-2 ring-sky-400 shadow-[0_0_25px_rgba(56,189,248,0.7)] bg-sky-400/5 animate-pulse"
        />
      )}

      {/* Balãozinho Compacto e Flutuante ao Lado da Função */}
      <div
        style={bubbleStyle}
        onClick={(e) => e.stopPropagation()}
        className="fixed z-50 bg-[#0c1f38]/95 backdrop-blur-md text-white rounded-2xl p-3 shadow-2xl border border-sky-400/40 space-y-2 animate-in zoom-in-95 duration-200"
      >
        {/* Setinha visual apontando para o elemento */}
        {step.preferredPosition === 'top' ? (
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#0c1f38] border-b border-r border-sky-400/40 rotate-45" />
        ) : step.preferredPosition === 'bottom-right' ? (
          <div className="absolute -top-1.5 right-4 w-3 h-3 bg-[#0c1f38] border-t border-l border-sky-400/40 rotate-45" />
        ) : (
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-[#0c1f38] border-t border-l border-sky-400/40 rotate-45" />
        )}

        {/* Topo do Balão: Ícone + Título + Contador */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <StepIcon size={14} className="text-sky-300 shrink-0" />
            <h4 className="text-xs font-bold text-white tracking-wide truncate">
              {step.title}
            </h4>
          </div>
          <span className="text-[10px] font-black text-sky-300/80 bg-white/10 px-1.5 py-0.5 rounded-full shrink-0">
            {step.badge}
          </span>
        </div>

        {/* Frase curta e direta */}
        <p className="text-[11.5px] text-slate-200 leading-snug font-normal">
          {step.description}
        </p>

        {/* Ações Compactas */}
        <div className="flex items-center justify-between pt-1 border-t border-white/10">
          <button
            onClick={handleComplete}
            className="text-[10.5px] text-slate-400 hover:text-white transition-colors"
          >
            Pular
          </button>

          <button
            onClick={handleNext}
            className="h-6 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-[11px] font-bold inline-flex items-center gap-1 transition-all active:scale-95 shadow-xs"
          >
            {isLast ? (
              <>
                <span>Entendi</span>
                <Check size={11} />
              </>
            ) : (
              <>
                <span>Próximo</span>
                <ArrowRight size={11} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
