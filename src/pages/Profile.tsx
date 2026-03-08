import { useState, useRef, useEffect } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Camera, Pencil, Check, X, Clock, Activity, RefreshCw, Trash2, Mail, Shield,
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
    <div className="animate-fade-in max-w-3xl mx-auto space-y-6 pb-10">
      {/* ── Hero Card ── */}
      <div className="relative overflow-hidden rounded-2xl bg-card border border-border shadow-sm">
        {/* Banner decorativo */}
        <div className="h-32 sm:h-36 bg-gradient-to-br from-primary via-primary/80 to-primary/50 relative">
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(circle at 20% 50%, hsl(var(--primary-foreground)) 1px, transparent 1px), radial-gradient(circle at 80% 20%, hsl(var(--primary-foreground)) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />
        </div>

        {/* Conteúdo sobre o banner */}
        <div className="px-6 sm:px-8 pb-8 -mt-16 relative">
          <div className="flex flex-col sm:flex-row sm:items-end gap-5">
            {/* Avatar */}
            <div className="relative group shrink-0">
              <div className="w-32 h-32 rounded-2xl overflow-hidden border-4 border-card shadow-lg bg-card">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <span className="text-4xl font-bold text-primary">{initials}</span>
                  </div>
                )}

                {/* Overlay hover */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute inset-0 rounded-2xl bg-foreground/0 group-hover:bg-foreground/40 transition-all duration-200 flex items-center justify-center cursor-pointer"
                  aria-label="Alterar foto"
                >
                  <Camera className="w-6 h-6 text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
                </button>

                {uploading && (
                  <div className="absolute inset-0 rounded-2xl bg-foreground/50 flex items-center justify-center">
                    <RefreshCw className="w-6 h-6 text-primary-foreground animate-spin" />
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

            {/* Info ao lado do avatar */}
            <div className="flex-1 min-w-0 sm:pb-1">
              {/* Nome editável */}
              {editingName ? (
                <div className="flex gap-2 max-w-sm">
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Seu nome"
                    onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                    autoFocus
                    className="text-lg font-semibold h-11"
                  />
                  <Button size="icon" variant="default" className="shrink-0 h-11 w-11" onClick={handleSaveName}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="shrink-0 h-11 w-11" onClick={() => setEditingName(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
                    {profile?.display_name || 'Sem nome'}
                  </h1>
                  <button
                    onClick={() => {
                      setEditName(profile?.display_name || '');
                      setEditingName(true);
                    }}
                    className="shrink-0 p-1.5 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2">
                {adminEmail && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Mail className="w-3.5 h-3.5" />
                    <span className="truncate">{adminEmail}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Shield className="w-3.5 h-3.5" />
                  <span>Administrador</span>
                </div>
                {profile?.created_at && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Desde {format(new Date(profile.created_at), "MMM yyyy", { locale: ptBR })}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Ações de foto */}
          <div className="flex gap-2 mt-5 ml-0 sm:ml-[152px]">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs rounded-xl"
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
                className="gap-1.5 text-xs text-destructive hover:text-destructive rounded-xl"
                onClick={handleRemoveAvatar}
                disabled={uploading}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remover
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Histórico de Ações ── */}
      <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
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
                  className="flex gap-3 p-3 rounded-xl hover:bg-muted/30 transition-colors text-sm group"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0">
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
