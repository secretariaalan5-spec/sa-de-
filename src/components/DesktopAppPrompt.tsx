import { useState, useEffect } from 'react';
import { Monitor, Download, BellRing, Zap, Rocket, CheckCircle2, ArrowUp, MousePointerClick } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoSaude from '@/assets/logo-saude.png';
import { saveCurrentSessionToComputerAccounts } from '@/lib/saved-accounts';

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

  // Não bloqueia o servidor local de desenvolvimento (npm run dev / localhost)
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return false;

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
    saveCurrentSessionToComputerAccounts();

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

  if (!eligible || !isOpen) return null;

  const handleDownloadClick = () => {
    setDownloadStarted(true);
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
    /* Fundo idêntico ao da tela de Login cobrindo 100% da janela (position fixed real, sem sidebar ao lado) */
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999 }}
      className="fixed inset-0 z-[9999] w-screen h-screen overflow-hidden select-none"
    >
      <div className="auth-bg__gradient" />
      <div className="auth-bg__pattern" aria-hidden="true" />

      {/* Seta Visual Alinhada Exatamente com o Download / Ícone de Download do Chrome (72px da direita) */}
      {downloadStarted && (
        <div className="fixed top-[74px] right-[24px] z-[210] flex flex-col items-end animate-bounce pointer-events-none">
          <div className="mr-[30px] w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-md border-2 border-white -mb-2 z-10">
            <ArrowUp className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div className="bg-white text-slate-900 px-4 py-2.5 rounded-2xl shadow-xl border border-slate-200 text-center">
            <p className="text-xs font-extrabold tracking-tight">Clique no arquivo baixado</p>
            <p className="text-[11px] text-slate-500 font-medium">Abra o SaudePlus-Instalador.exe</p>
          </div>
        </div>
      )}

      <div className="auth-bg__content flex-col">
        <div className="max-w-[440px] w-full px-4 animate-in fade-in zoom-in-95 duration-500">
          {/* Card idêntico ao da tela de Login (.auth-card) */}
          <div className="auth-card">
            {/* Header & Logo idênticos ao Login */}
            <div className="text-center mb-7">
              <div className="inline-flex p-1.5 rounded-[1.5rem] bg-white/10 backdrop-blur-md shadow-inner mb-4">
                <img
                  src={logoSaude}
                  alt="Saúde+ Official"
                  className="w-24 h-24 object-contain rounded-[1.2rem]"
                />
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tighter">
                Saúde+ Escalas
              </h1>
              <p className="text-xs font-semibold text-slate-500 mt-1.5">
                {downloadStarted
                  ? 'Abra o arquivo baixado acima para entrar'
                  : 'Aplicativo Oficial para Computador (Windows)'}
              </p>
            </div>

            {!downloadStarted ? (
              <div className="space-y-4">
                <p className="text-center text-[13px] font-semibold text-slate-400 uppercase tracking-widest">
                  Instalação Rápida
                </p>

                <Button
                  onClick={handleDownloadClick}
                  className="w-full h-[54px] text-[15px] font-bold gap-3 rounded-2xl shadow-md hover:shadow-lg transition-all"
                >
                  <Download className="w-5 h-5" />
                  Baixar Aplicativo Windows
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-slate-200 bg-white shadow-sm text-left">
                  <img
                    src={logoSaude}
                    alt="Saúde+"
                    className="w-10 h-10 rounded-xl object-contain shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      SaudePlus-Instalador.exe
                    </p>
                    <p className="text-xs text-slate-500 font-medium">
                      Clique no arquivo baixado acima para abrir
                    </p>
                  </div>
                  <MousePointerClick className="w-5 h-5 text-primary animate-bounce shrink-0" />
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 text-center">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Se o Windows exibir um aviso, clique em{' '}
                    <span className="font-bold text-slate-900 underline">Mais informações</span> e depois em{' '}
                    <span className="font-bold text-slate-900">Executar assim mesmo</span>.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadClick}
                  className="text-xs text-primary hover:underline font-semibold block mx-auto pt-1"
                >
                  Baixar novamente
                </button>
              </div>
            )}

            {/* Rodapé Institucional idêntico ao da tela de Login */}
            <div className="mt-7 pt-5 border-t border-slate-100 flex flex-col items-center gap-2">
              <p className="text-xs text-slate-500 font-medium text-center">
                Acesso exclusivo para administradores, chefes de categoria e gerentes de unidade.
              </p>
            </div>
          </div>

          {/* Copyright & Opção discreta */}
          <div className="mt-6 text-center space-y-2">
            <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">
              © 2026 Saúde+ Tecnologia em Saúde
            </p>
            {!downloadStarted && (
              <button
                type="button"
                onClick={handleContinueInBrowser}
                className="text-[10px] text-white/25 hover:text-white/55 transition-colors block mx-auto"
              >
                manter pelo navegador
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
