import { useState, useRef, useEffect } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Camera, Pencil, Check, X, Clock, Activity, RefreshCw, Trash2, Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

/* ── Rótulos legíveis para cada tipo de ação ── */
const ACTION_LABELS: Record<string, string> = {
  leave_request_created: '📋 Registrou pedido de folga',
  leave_request_deleted: '🗑️ Removeu pedido de folga',
  schedule_published: '📤 Publicou escala no portal',
  professional_approved: '✅ Aprovou profissional',
  portal_leave_approved: '✅ Aprovou folga do portal',
};

const SUPABASE_URL = 'https://qxpqzbswtdfatdrtqhrw.supabase.co';

export default function ProfilePage() {
  const {
    profile, activityLog, loading, updateProfile, refreshProfile,
  } = useProfile();

  /* ── Estado local ── */
  const [editName, setEditName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Buscar email do auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setAdminEmail(user.email);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /* ── Salvar nome ── */
  const handleSaveName = () => {
    if (editName.trim()) {
      updateProfile({ display_name: editName.trim() });
      setEditingName(false);
    }
  };

  /* ── Upload de avatar ── */
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    // Validação de tamanho (max 2 MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2 MB');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `${profile.user_id}/avatar.${ext}`;

      // Upload para o bucket 'avatars'
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      // URL pública do avatar
      const avatarUrl = `${SUPABASE_URL}/storage/v1/object/public/avatars/${filePath}?t=${Date.now()}`;

      // Salva no perfil
      await updateProfile({ avatar_url: avatarUrl });
      toast.success('Foto de perfil atualizada!');
    } catch (err: any) {
      console.error('Erro ao enviar avatar:', err);
      toast.error('Erro ao enviar foto: ' + (err.message || ''));
    } finally {
      setUploading(false);
      // Limpa o input para permitir reenvio do mesmo arquivo
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /* ── Remover avatar ── */
  const handleRemoveAvatar = async () => {
    if (!profile?.avatar_url) return;
    setUploading(true);
    try {
      // Extrai o caminho do arquivo a partir da URL
      const pathMatch = profile.avatar_url.match(/avatars\/(.+?)(\?|$)/);
      if (pathMatch?.[1]) {
        await supabase.storage.from('avatars').remove([pathMatch[1]]);
      }
      await updateProfile({ avatar_url: null as any });
      toast.success('Foto removida');
    } catch {
      toast.error('Erro ao remover foto');
    } finally {
      setUploading(false);
    }
  };

  /* ── Iniciais para avatar fallback ── */
  const initials = (profile?.display_name || '?')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="animate-fade-in space-y-6 max-w-2xl">
      <PageHeader
        title="Meu Perfil"
        description="Gerencie sua foto, nome e acompanhe suas ações"
      />

      {/* ── Card principal: Avatar + Nome ── */}
      <Card>
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col items-center gap-5">

            {/* Avatar com botão de câmera */}
            <div className="relative group">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className="w-28 h-28 rounded-full object-cover border-4 border-border shadow-md"
                />
              ) : (
                <div className="w-28 h-28 rounded-full bg-primary/15 border-4 border-border shadow-md flex items-center justify-center">
                  <span className="text-3xl font-bold text-primary">{initials}</span>
                </div>
              )}

              {/* Overlay de câmera */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 rounded-full bg-foreground/0 group-hover:bg-foreground/40 transition-colors flex items-center justify-center cursor-pointer"
                aria-label="Alterar foto"
              >
                <Camera className="w-6 h-6 text-background opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>

              {/* Indicador de loading */}
              {uploading && (
                <div className="absolute inset-0 rounded-full bg-foreground/50 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 text-background animate-spin" />
                </div>
              )}

              {/* Input file escondido */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
            </div>

            {/* Botões de foto */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Camera className="w-3.5 h-3.5" />
                {profile?.avatar_url ? 'Trocar foto' : 'Adicionar foto'}
              </Button>
              {profile?.avatar_url && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-xs text-destructive hover:text-destructive"
                  onClick={handleRemoveAvatar}
                  disabled={uploading}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remover
                </Button>
              )}
            </div>

            {/* Nome de exibição */}
            <div className="w-full max-w-sm space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome de exibição</Label>
              {editingName ? (
                <div className="flex gap-2">
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Seu nome"
                    onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                    autoFocus
                  />
                  <Button size="icon" variant="default" className="shrink-0" onClick={handleSaveName}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="shrink-0" onClick={() => setEditingName(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between bg-muted/40 rounded-lg px-4 py-2.5 border border-border">
                  <span className="font-semibold text-foreground">
                    {profile?.display_name || 'Sem nome'}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    onClick={() => {
                      setEditName(profile?.display_name || '');
                      setEditingName(true);
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {/* Membro desde */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              Membro desde{' '}
              {profile?.created_at &&
                format(new Date(profile.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Histórico de Ações ── */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Histórico de Ações
            </h2>
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={refreshProfile}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>

          {activityLog.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma ação registrada ainda.
            </p>
          ) : (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {activityLog.map(log => (
                <div
                  key={log.id}
                  className="flex gap-3 p-3 rounded-lg bg-muted/30 border border-border text-sm"
                >
                  {/* Avatar pequeno do autor */}
                  <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                    {(log.profile?.display_name || '?')[0].toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-xs text-muted-foreground">
                      {log.profile?.display_name || 'Desconhecido'}
                    </div>
                    <div className="text-sm text-foreground">
                      {ACTION_LABELS[log.action] || log.action}
                    </div>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {(log.details as any).professionalName &&
                          `Profissional: ${(log.details as any).professionalName}`}
                        {(log.details as any).leaveType &&
                          ` • ${(log.details as any).leaveType}`}
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
