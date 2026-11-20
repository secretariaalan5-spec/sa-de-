import { useState, useEffect } from 'react';
import { Monitor, Download, BellRing, Zap, CheckCircle2, ArrowUpRight, ShieldCheck, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import logoSaude from '@/assets/logo-saude.png';

export const DESKTOP_INSTALLER_URL =
  import.meta.env.VITE_DESKTOP_DOWNLOAD_URL ||
  'https://github.com/secretariaalan5-spec/sa-de-/releases/download/v1.0.0/SaudePlus-Instalador.exe';

const STORAGE_DISMISSED_KEY = 'saude_desktop_prompt_dismissed_v1';
const STORAGE_DOWNLOADED_KEY = 'saude_desktop_app_downloaded_v1';

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

    const alreadyDismissed = localStorage.getItem(STORAGE_DISMISSED_KEY) === 'true';
    const alreadyDownloaded = localStorage.getItem(STORAGE_DOWNLOADED_KEY) === 'true';

    if (!alreadyDismissed && !alreadyDownloaded) {
      const timer = setTimeout(() => {
        setInternalOpen(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const isOpen = Boolean(externalOpen || internalOpen);

  const handleOpenChange = (nextOpen: boolean) => {
    setInternalOpen(nextOpen);
    onExternalOpenChange?.(nextOpen);
    if (!nextOpen) {
      localStorage.setItem(STORAGE_DISMISSED_KEY, 'true');
      setDownloadStarted(false);
    }
  };

  if (!eligible) return null;

  const handleDownloadClick = () => {
    localStorage.setItem(STORAGE_DOWNLOADED_KEY, 'true');
    setDownloadStarted(true);

    // Inicia o download direto do instalador
    const link = document.createElement('a');
    link.href = DESKTOP_INSTALLER_URL;
    link.setAttribute('download', 'SaudePlus-Instalador.exe');
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDismissInBrowser = () => {
    localStorage.setItem(STORAGE_DISMISSED_KEY, 'true');
    handleOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[460px] p-0 overflow-hidden border-primary/20 shadow-2xl rounded-2xl"
        onInteractOutside={(e) => {
          // Evita fechar sem querer clicando fora antes de escolher
          if (!downloadStarted) e.preventDefault();
        }}
      >
        {/* Cabeçalho Visual com Gradiente Oficial */}
        <div className="bg-gradient-to-br from-primary via-primary to-blue-700 p-6 text-primary-foreground relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
          <div className="flex items-center gap-3.5 relative z-10">
            <img
              src={logoSaude}
              alt="Saúde+"
              className="w-12 h-12 rounded-xl shadow-lg border border-white/20 bg-white/10"
            />
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 text-[11px] font-semibold tracking-wide mb-1">
                <Sparkles className="w-3 h-3" />
                Versão Oficial para Windows
              </div>
              <DialogTitle className="text-lg font-bold leading-snug text-white">
                {downloadStarted
                  ? 'Quase lá! Siga os 2 passos abaixo'
                  : 'Saúde+ para Computador'}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-primary-foreground/85 text-xs mt-2.5 leading-relaxed relative z-10">
            {downloadStarted
              ? 'O arquivo SaudePlus-Instalador.exe começou a baixar no seu navegador.'
              : 'Instale o aplicativo oficial para receber alertas de escalas, plantões e folgas na tela do Windows mesmo com o navegador fechado.'}
          </DialogDescription>
        </div>

        {!downloadStarted ? (
          <div className="p-6 space-y-5 bg-card">
            {/* Benefícios claros */}
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
                <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <BellRing className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Notificações em Segundo Plano
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Fica ativo perto do relógio do Windows e avisa na hora quando houver novidades, mesmo se você fechar a janela no &quot;X&quot;.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 border border-border/60">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">
                    Ultra Leve e Automático
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Consome 10x menos memória que o navegador, cria o ícone na Área de Trabalho e inicia sozinho com o Windows.
                  </p>
                </div>
              </div>
            </div>

            {/* Botão Principal Grande em Destaque */}
            <div className="pt-1 flex flex-col items-center">
              <Button
                onClick={handleDownloadClick}
                size="lg"
                className="w-full h-12 text-sm font-bold gap-2.5 rounded-xl shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
              >
                <Download className="w-4 h-4 animate-bounce" />
                Baixar Aplicativo para Windows (Recomendado)
              </Button>

              {/* Link de escape bem pequeno e discreto */}
              <button
                type="button"
                onClick={handleDismissInBrowser}
                className="mt-4 text-[10px] text-muted-foreground/45 hover:text-muted-foreground/75 transition-colors underline-offset-2 hover:underline"
              >
                continuar usando apenas pelo navegador
              </button>
            </div>
          </div>
        ) : (
          /* Guia Visual Passo a Passo após clicar em Baixar */
          <div className="p-6 space-y-4 bg-card">
            <div className="space-y-3">
              {/* Passo 1 */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/25">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  1
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-foreground">
                      Clique no arquivo baixado no navegador
                    </p>
                    <ArrowUpRight className="w-4 h-4 text-primary animate-pulse" />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    Olhe no <strong>canto superior direito</strong> (ou inferior) do seu navegador e clique em{' '}
                    <code className="px-1.5 py-0.5 rounded bg-background border text-foreground font-semibold">
                      SaudePlus-Instalador.exe
                    </code>
                  </p>
                </div>
              </div>

              {/* Passo 2 */}
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25">
                <div className="w-6 h-6 rounded-full bg-amber-600 text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                  2
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                    <p className="text-xs font-bold text-foreground">
                      Se o Windows perguntar ao abrir:
                    </p>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                    Caso apareça a janela azul do Windows, clique em{' '}
                    <strong className="text-foreground">&quot;Mais informações&quot;</strong> e depois no botão{' '}
                    <strong className="text-foreground">&quot;Executar assim mesmo&quot;</strong>.
                  </p>
                </div>
              </div>

              {/* Passo 3 */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  <strong className="text-foreground">Tudo automático:</strong> O Saúde+ vai instalar em 1 segundo, colocar o ícone na sua Área de Trabalho e abrir sozinho na tela!
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Button
                onClick={() => handleOpenChange(false)}
                className="w-full h-11 rounded-xl font-semibold text-xs"
              >
                <Monitor className="w-4 h-4 mr-2" />
                Entendi, já cliquei para abrir o aplicativo
              </Button>
              <button
                type="button"
                onClick={handleDownloadClick}
                className="text-[11px] text-primary hover:underline text-center py-1"
              >
                O download não começou? Clique aqui para baixar novamente
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
