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
  return false;
}

interface DesktopAppPromptProps {
  externalOpen?: boolean;
  onExternalOpenChange?: (open: boolean) => void;
}

export function DesktopAppPrompt(_props: DesktopAppPromptProps) {
  return null;
}
