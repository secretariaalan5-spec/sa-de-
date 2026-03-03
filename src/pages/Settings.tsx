import { useRef, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useAppData } from '@/hooks/useAppData';
import { Button } from '@/components/ui/button';
import {
  Download, Upload, Trash2, AlertTriangle, Database,
} from 'lucide-react';
import { toast } from 'sonner';
import { useServiceState } from '@/hooks/useServiceState';
import { useSettingsActions } from '@/hooks/useSettingsActions';

import { ServiceProfessional, ServiceScheduleEntry, LeaveRequest } from '@/types/serviceSchedule';

// ── Tipos ──────────────────────────────────────────────────────────────────

interface FullBackupData {
  emult: Record<string, unknown>;
  serviceSchedule: {
    professionals: ServiceProfessional[];
    entries: ServiceScheduleEntry[];
    creditsUsed: Record<string, number>;
    leaveRequests: LeaveRequest[];
  };
  backupVersion: number;
  backupDate: string;
}

// ── Página principal ───────────────────────────────────────────────────────

export default function Settings() {
  const { exportData, importData } = useAppData();
  const { state: serviceState, updateServiceState } = useServiceState();
  const { resetAllCloudData } = useSettingsActions();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Exportação de backup completo ──
  const handleExport = () => {
    const emultData = JSON.parse(exportData());
    const fullBackup: FullBackupData = {
      emult: emultData,
      serviceSchedule: {
        professionals: serviceState.professionals,
        entries: serviceState.entries,
        creditsUsed: {},
        leaveRequests: serviceState.requests,
      },
      backupVersion: 2,
      backupDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `escala-completa-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Backup completo exportado!');
  };

  // ── Importação de backup ──
  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (parsed.backupVersion === 2 && parsed.emult && parsed.serviceSchedule) {
          const emultSuccess = importData(JSON.stringify(parsed.emult));
          updateServiceState(() => ({
            professionals: parsed.serviceSchedule.professionals || [],
            entries: parsed.serviceSchedule.entries || [],
            requests: parsed.serviceSchedule.leaveRequests || [],
          }));
          if (emultSuccess) {
            toast.success('Backup importado com sucesso!');
            setTimeout(() => window.location.reload(), 1000);
          } else {
            toast.error('Erro ao importar dados eMult.');
          }
        } else {
          const success = importData(e.target?.result as string);
          if (success) toast.success('Dados importados (formato legado).');
          else toast.error('Erro ao importar. Verifique o arquivo.');
        }
      } catch {
        toast.error('Erro ao ler o arquivo de backup.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Reset ──
  const handleReset = async () => {
    const c1 = confirm('ATENÇÃO: Isso apagará TODOS os dados (eMult + Escalas de Serviço) da NUVEM. Esta ação não pode ser desfeita. Continuar?');
    if (!c1) return;
    const c2 = confirm('Tem certeza? Todos os profissionais, unidades, escalas e pedidos de folga serão perdidos para sempre em todos os seus dispositivos.');
    if (!c2) return;
    await resetAllCloudData();
    setTimeout(() => window.location.reload(), 1000);
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Configurações"
        description="Gerencie backup e dados do sistema"
      />

      <div className="space-y-5 max-w-3xl">

        {/* ── Backup & Restauração ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <section className="form-section">
            <h3 className="font-semibold flex items-center gap-2 mb-1">
              <Database className="w-4 h-4 text-primary" />
              Exportar Backup
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Salve todos os dados em JSON (eMult + Escalas de Serviço + Pedidos de Folga).
            </p>
            <Button onClick={handleExport} className="w-full sm:w-auto">
              <Download className="w-4 h-4 mr-2" />
              Exportar Backup
            </Button>
          </section>

          <section className="form-section">
            <h3 className="font-semibold flex items-center gap-2 mb-1">
              <Upload className="w-4 h-4 text-primary" />
              Restaurar Backup
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Importe um arquivo de backup. Os dados atuais serão completamente substituídos.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Importar Backup
            </Button>
          </section>
        </div>

        {/* ── Zona de Perigo ── */}
        <section className="form-section border-destructive/30">
          <h3 className="font-semibold mb-1 text-destructive flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Zona de Perigo
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Apaga permanentemente todos os dados (eMult + Escalas de Serviço) da nuvem e de todos os dispositivos.
            <strong className="text-destructive"> Esta ação é irreversível.</strong>
          </p>
          <Button variant="destructive" onClick={handleReset}>
            <Trash2 className="w-4 h-4 mr-2" />
            Resetar Todos os Dados
          </Button>
        </section>

      </div>
    </div>
  );
}
