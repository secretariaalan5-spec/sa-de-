import { useState, useRef, useEffect } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Camera, Pencil, Check, X, Clock, Activity, RefreshCw, Trash2, Mail, Shield, User,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

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

  const [editName, setEditName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleSaveName = () => {
    if (editName.trim()) {
      updateProfile({ display_name: editName.trim() });
      setEditingName(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 2 MB');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const filePath = `${profile.user_id}/avatar.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const avatarUrl = `${SUPABASE_URL}/storage/v1/object/public/avatars/${filePath}?t=${Date.now()}`;
      await updateProfile({ avatar_url: avatarUrl });
      toast.success('Foto de perfil atualizada!');
    } catch (err: any) {
      console.error('Erro ao enviar avatar:', err);
      toast.error('Erro ao enviar foto: ' + (err.message || ''));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!profile?.avatar_url) return;
    setUploading(true);
    try {
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

  const initials = (profile?.display_name || '?')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="animate-fade-in max-w-2xl mx-auto pb-10 pt-2">
      {/* ── Cabeçalho da página ── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Meu Perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie suas informações pessoais</p>
      </div>

      {/* ── Card de Perfil ── */}
      <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
        {/* Avatar centralizado com fundo sutil */}
        <div className="flex flex-col items-center pt-10 pb-6 px-6 bg-gradient-to-b from-muted/40 to-card">
          {/* Avatar redondo */}
          <div className="relative group mb-4">
            <div className="w-28 h-28 rounded-full overflow-hidden border-[3px] border-card shadow-xl ring-4 ring-primary/10 bg-card">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 flex items-center justify-center">
                  <span className="text-3xl font-bold text-primary select-none">{initials}</span>
                </div>
              )}

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 rounded-full bg-foreground/0 group-hover:bg-foreground/40 transition-all duration-200 flex items-center justify-center cursor-pointer"
                aria-label="Alterar foto"
              >
                <Camera className="w-5 h-5 text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
              </button>

              {uploading && (
                <div className="absolute inset-0 rounded-full bg-foreground/50 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-primary-foreground animate-spin" />
                </div>
              )}
            </div>

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
              className="gap-1.5 text-xs rounded-full h-8 px-4"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Camera className="w-3 h-3" />
              {profile?.avatar_url ? 'Trocar' : 'Adicionar foto'}
            </Button>
            {profile?.avatar_url && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-xs text-destructive hover:text-destructive rounded-full h-8 px-4"
                onClick={handleRemoveAvatar}
                disabled={uploading}
              >
                <Trash2 className="w-3 h-3" />
                Remover
              </Button>
            )}
          </div>
        </div>

        {/* Informações do perfil */}
        <div className="px-6 pb-6 space-y-4">
          {/* Nome */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <User className="w-3 h-3" />
              Nome de exibição
            </label>
            {editingName ? (
              <div className="flex gap-2">
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Seu nome"
                  onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                  autoFocus
                  className="font-medium"
                />
                <Button size="icon" variant="default" className="shrink-0" onClick={handleSaveName}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="shrink-0" onClick={() => setEditingName(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditName(profile?.display_name || '');
                  setEditingName(true);
                }}
                className="w-full flex items-center justify-between rounded-xl bg-muted/30 border border-border px-4 py-3 text-left hover:bg-muted/50 transition-colors group"
              >
                <span className="font-semibold text-foreground">
                  {profile?.display_name || 'Sem nome'}
                </span>
                <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <Mail className="w-3 h-3" />
              E-mail
            </label>
            <div className="rounded-xl bg-muted/30 border border-border px-4 py-3">
              <span className="text-sm text-foreground">{adminEmail || '—'}</span>
            </div>
          </div>

          {/* Linha de meta dados */}
          <div className="flex items-center gap-4 pt-2">
            <div className="inline-flex items-center gap-1.5 text-xs font-medium text-primary bg-primary/10 rounded-full px-3 py-1.5">
              <Shield className="w-3 h-3" />
              Administrador
            </div>
            {profile?.created_at && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                Desde {format(new Date(profile.created_at), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Histórico de Ações ── */}
      <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden mt-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground flex items-center gap-2 text-sm">
            <Activity className="w-4 h-4 text-primary" />
            Histórico de Ações
          </h2>
          <Button size="icon" variant="ghost" className="h-8 w-8 rounded-xl" onClick={refreshProfile}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-4">
          {activityLog.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Nenhuma ação registrada ainda.
              </p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
              {activityLog.map(log => (
                <div
                  key={log.id}
                  className="flex gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors text-sm"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
                    {(log.profile?.display_name || '?')[0].toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground text-sm">
                        {log.profile?.display_name || 'Desconhecido'}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(log.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {ACTION_LABELS[log.action] || log.action}
                    </div>
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="text-xs text-muted-foreground/80 mt-0.5">
                        {(log.details as any).professionalName &&
                          `Profissional: ${(log.details as any).professionalName}`}
                        {(log.details as any).leaveType &&
                          ` · ${(log.details as any).leaveType}`}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
