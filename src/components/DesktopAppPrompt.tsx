import { useState, useEffect } from 'react';
import { Download, BellRing, Zap, Rocket, CheckCircle2, ArrowUp, MousePointerClick, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoSaude from '@/assets/logo-saude.png';
import {
  saveCurrentSessionToComputerAccounts,
  SAVED_ACCOUNTS_STORAGE_KEY,
} from '@/lib/saved-accounts';

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

function getActiveAuthTokenPayload(): { key: string; value: string } | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('sb-') && k.endsWith('-auth-token')) {
        const v = localStorage.getItem(k);
        if (v) return { key: k, value: v };
      }
    }
  } catch {}
  return null;
}

async function syncAccountsToLocalDesktopApp(bringToFront = false): Promise<boolean> {
  try {
    const accounts = saveCurrentSessionToComputerAccounts();
    const activeToken = getActiveAuthTokenPayload();
    const res = await fetch(
      `http://127.0.0.1:47831/sync-auth${bringToFront ? '?show=1' : ''}`,
      {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accounts,
          activeToken,
        }),
      }
    );
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && Array.isArray(data.accounts)) {
        localStorage.setItem(SAVED_ACCOUNTS_STORAGE_KEY, JSON.stringify(data.accounts));
      }
      return true;
    }
  } catch {
    // App desktop ainda não iniciado
  }
  return false;
}

interface DesktopAppPromptProps {
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export function DesktopAppPrompt({ externalOpen, onExternalOpenChange }: DesktopAppPromptProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [appOpenedConfirm, setAppOpenedConfirm] = useState(false);

  useEffect(() => {
    // Salva a conta logada atual na lista de contas deste computador e sincroniza
    saveCurrentSessionToComputerAccounts();
    syncAccountsToLocalDesktopApp(false);

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

  // Enquanto estiver aguardando instalar/abrir, sincroniza a conta logada com o App Desktop
  // assim que o usuário clicar no SaudePlus-Instalador.exe
  useEffect(() => {
    if (!isOpen || !downloadStarted) return;

    const checkAndSync = async () => {
      const ok = await syncAccountsToLocalDesktopApp(true);
      if (ok) {
        setAppOpenedConfirm(true);
      }
    };

    const interval = setInterval(checkAndSync, 1500);
    return () => clearInterval(interval);
  }, [isOpen, downloadStarted]);

  if (!eligible || !isOpen) return null;

  const handleDownloadClick = () => {
    setDownloadStarted(true);
    setAppOpenedConfirm(false);
    saveCurrentSessionToComputerAccounts();

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
    /* Fundo 100% opaco cobrindo toda a tela: bloqueia uso do sistema web atrás e não tem botão X */
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
                  Fixa na Barra
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
          /* Enquanto baixa/instala: NÃO libera o uso web, aguarda abrir o aplicativo Desktop */
          <div className="p-6 space-y-5">
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-primary/40 flex flex-col items-center gap-3">
              <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl shadow-md border border-primary/30 w-full">
                <img src={logoSaude} alt="Saúde+" className="w-9 h-9 rounded-lg shrink-0" />
                <div className="text-left flex-1 min-w-0">
                  <p className="text-xs font-extrabold text-foreground truncate">
                    SaudePlus-Instalador.exe
                  </p>
                  <p className="text-[10px] text-emerald-600 font-semibold">
                    Clique nele lá em cima para instalar e abrir
                  </p>
                </div>
                <MousePointerClick className="w-6 h-6 text-primary animate-bounce shrink-0" />
              </div>

              {appOpenedConfirm ? (
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Aplicativo Desktop aberto e sincronizado com sua conta!</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  <span>Aguardando você clicar no arquivo baixado...</span>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleDownloadClick}
              className="text-xs text-primary hover:underline font-semibold block mx-auto"
            >
              O download não apareceu? Clique aqui para baixar novamente
            </button>
          </div>
        )}
      </div>

      {/* Botão bem pequeno e discreto fora do card principal (apenas antes de iniciar o download) */}
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
