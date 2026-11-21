import { useState, useEffect } from 'react';
import { Monitor, Download, BellRing, Zap, Rocket, CheckCircle2, ArrowUp, MousePointerClick } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoSaude from '@/assets/logo-saude.png';

export const DESKTOP_INSTALLER_URL =
  import.meta.env.VITE_DESKTOP_DOWNLOAD_URL ||
  'https://github.com/secretariaalan5-spec/sa-de-/releases/download/v1.0.0/SaudePlus-Instalador.exe';

const SESSION_DISMISSED_KEY = 'saude_desktop_prompt_session_dismissed';

export function isRunningInsideDesktopApp(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(
    w.__SAUDE_DESKTOP_APP__ ||
    w.__IS_TAURI_DESKTOP ||
    w.__SAUDE_TAURI_BRIDGE__ ||
    w.__TAURI__ ||
    w.__TAURI_INTERNALS__
  );
}

export function isWindowsDesktopBrowser(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (isRunningInsideDesktopApp()) return false;

  const ua = navigator.userAgent || '';
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  if (isMobileDevice) return false;

  return /Windows/i.test(ua);
}

interface DesktopAppPromptProps {
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export function DesktopAppPrompt({ externalOpen, onExternalOpenChange }: DesktopAppPromptProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [eligible, setEligible] = useState(false);

  useEffect(() => {
    const canShowOnThisDevice = isWindowsDesktopBrowser();
    setEligible(canShowOnThisDevice);

    if (!canShowOnThisDevice) return;

    const dismissedInThisSession = sessionStorage.getItem(SESSION_DISMISSED_KEY) === 'true';

    if (!dismissedInThisSession) {
      setInternalOpen(true);
    }
  }, []);

  const isOpen = Boolean(externalOpen || internalOpen);

  const closePrompt = () => {
    setInternalOpen(false);
    onExternalOpenChange?.(false);
    setDownloadStarted(false);
  };

  // Detecta automaticamente assim que o usuário clica no SaudePlus-Instalador.exe e o app abre
  useEffect(() => {
    if (!isOpen || !downloadStarted) return;

    const checkLocalApp = async () => {
      try {
        const res = await fetch('http://127.0.0.1:47831/ping', { mode: 'cors' });
        if (res.ok) {
          sessionStorage.setItem(SESSION_DISMISSED_KEY, 'true');
          closePrompt();
        }
      } catch {
        // Ainda aguardando o usuário clicar no arquivo baixado
      }
    };

    const interval = setInterval(checkLocalApp, 1500);
    return () => clearInterval(interval);
  }, [isOpen, downloadStarted]);

  if (!eligible || !isOpen) return null;

  const handleDownloadClick = () => {
    setDownloadStarted(true);

    const link = document.createElement('a');
    link.href = DESKTOP_INSTALLER_URL;
    link.setAttribute('download', 'SaudePlus-Instalador.exe');
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleContinueInBrowser = () => {
    sessionStorage.setItem(SESSION_DISMISSED_KEY, 'true');
    closePrompt();
  };

  return (
    /* Fundo 100% opaco cobrindo toda a tela: não mostra nada do sistema atrás e não tem botão X */
    <div className="fixed inset-0 z-[200] bg-gradient-to-br from-slate-950 via-[#0a1936] to-slate-950 flex flex-col items-center justify-center p-4 select-none overflow-hidden">
      {/* Brilhos decorativos de fundo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[130px] pointer-events-none" />

      {/* Seta Visual Posicionada Exatamente Abaixo da Caixinha Preta de Download do Navegador */}
      {downloadStarted && (
        <div className="fixed top-[84px] right-[135px] z-[210] flex flex-col items-center animate-bounce pointer-events-none">
          <div className="w-9 h-9 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg border-2 border-white -mb-2 z-10">
            <ArrowUp className="w-6 h-6 stroke-[3]" />
          </div>
          <div className="bg-primary text-white px-4 py-2.5 rounded-2xl shadow-2xl border-2 border-white/30 text-center">
            <p className="text-xs font-extrabold uppercase tracking-wider">Clique no arquivo acima</p>
            <p className="text-[11px] text-white/90">Abra o SaudePlus-Instalador.exe</p>
          </div>
        </div>
      )}

      {/* Card Central Simples e Visual */}
      <div className="relative z-10 w-full max-w-[420px] bg-white dark:bg-slate-900 rounded-3xl shadow-[0_25px_70px_rgba(0,0,0,0.65)] border border-white/15 overflow-hidden text-center">
        {/* Topo Visual com Ilustração */}
        <div className="bg-gradient-to-b from-primary to-blue-700 pt-8 pb-7 px-6 text-white relative">
          <div className="relative mx-auto w-20 h-20 rounded-2xl bg-white/15 backdrop-blur-md p-2.5 shadow-xl border border-white/30 flex items-center justify-center">
            <img src={logoSaude} alt="Saúde+" className="w-full h-full object-contain rounded-xl" />
            <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center shadow-md">
              <BellRing className="w-4 h-4 text-white animate-pulse" />
            </div>
          </div>

          <h1 className="text-xl font-extrabold mt-4 tracking-tight">
            {downloadStarted ? 'Abra o Arquivo Baixado!' : 'Saúde+ para Windows'}
          </h1>
          <p className="text-xs text-white/80 mt-1">
            {downloadStarted
              ? 'Dê 1 clique no arquivo baixado ali em cima para iniciar'
              : 'Receba notificações mesmo com o sistema fechado'}
          </p>
        </div>

        {!downloadStarted ? (
          <div className="p-6 space-y-6">
            {/* 3 Ícones Visuais Diretos */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-primary/5 border border-primary/15">
                <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                  <BellRing className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-foreground leading-tight">
                  Notifica Fechado
                </span>
              </div>

              <div className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/15">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                  <Zap className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-foreground leading-tight">
                  10x Mais Leve
                </span>
              </div>

              <div className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-blue-500/5 border border-blue-500/15">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-600 flex items-center justify-center">
                  <Rocket className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-foreground leading-tight">
                  Inicia com o PC
                </span>
              </div>
            </div>

            {/* Botão Principal Grande */}
            <Button
              onClick={handleDownloadClick}
              size="lg"
              className="w-full h-14 text-base font-extrabold gap-3 rounded-2xl shadow-xl shadow-primary/30 hover:shadow-primary/45 hover:scale-[1.01] transition-all"
            >
              <Download className="w-5 h-5 animate-bounce" />
              Baixar Aplicativo Agora
            </Button>
          </div>
        ) : (
          /* Tela Visual Passo a Passo após clicar em Baixar */
          <div className="p-6 space-y-5">
            {/* Ilustração Visual do Arquivo no Navegador */}
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-primary/40 flex flex-col items-center gap-3">
              <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl shadow-md border border-primary/30 w-full">
                <img src={logoSaude} alt="Saúde+" className="w-9 h-9 rounded-lg shrink-0" />
                <div className="text-left flex-1 min-w-0">
                  <p className="text-xs font-extrabold text-foreground truncate">
                    SaudePlus-Instalador.exe
                  </p>
                  <p className="text-[10px] text-emerald-600 font-semibold">
                    Clique nele lá em cima para abrir
                  </p>
                </div>
                <MousePointerClick className="w-6 h-6 text-primary animate-bounce shrink-0" />
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Assim que você clicar nele, o Saúde+ abrirá sozinho!</span>
              </div>
            </div>

            <div className="space-y-2">
              <Button
                onClick={handleContinueInBrowser}
                className="w-full h-12 rounded-2xl font-bold text-sm"
              >
                <Monitor className="w-4 h-4 mr-2" />
                Já abri o aplicativo / Entrar
              </Button>

              <button
                type="button"
                onClick={handleDownloadClick}
                className="text-[11px] text-primary hover:underline font-medium block mx-auto pt-1"
              >
                Baixar novamente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Botão bem pequeno e discreto fora do card principal para manter pelo navegador */}
      {!downloadStarted && (
        <button
          type="button"
          onClick={handleContinueInBrowser}
          className="relative z-10 mt-6 text-[10px] text-white/25 hover:text-white/55 transition-colors"
        >
          manter pelo navegador
        </button>
      )}
    </div>
  );
}
