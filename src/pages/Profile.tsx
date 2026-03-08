import { useState, useRef, useEffect } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Camera, Pencil, Check, X, Clock, Activity, RefreshCw, Trash2, Mail, Shield, User, CalendarDays,
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
    <div className="animate-fade-in max-w-xl mx-auto pb-10 pt-2 px-4">
      {/* ── Hero section com avatar ── */}
      <div className="relative rounded-2xl overflow-hidden bg-card border border-border shadow-sm">
        {/* Banner gradient */}
        <div className="h-28 bg-gradient-to-r from-primary via-primary/85 to-primary/60 relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,hsl(var(--primary-foreground)/0.08),transparent_70%)]" />
        </div>

        {/* Avatar flutuante */}
        <div className="flex flex-col items-center -mt-14 relative z-10 pb-6">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-card shadow-lg bg-card">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary select-none">{initials}</span>
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute inset-0 rounded-full bg-foreground/0 group-hover:bg-foreground/40 transition-all duration-200 flex items-center justify-center cursor-pointer"
                aria-label="Alterar foto"
              >
                <Camera className="w-5 h-5 text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
              </button>
              {uploading && (
                <div className="absolute inset-0 rounded-full bg-foreground/50 flex items-center justify-center">
                  <RefreshCw className="w-5 h-5 text-primary-foreground animate-spin" />
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>

          {/* Ações de foto */}
          <div className="flex gap-1.5 mt-3">
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-xs h-7 px-3 text-muted-foreground hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Camera className="w-3 h-3" />
              {profile?.avatar_url ? 'Trocar foto' : 'Adicionar foto'}
            </Button>
            {profile?.avatar_url && (
              <Button
                size="sm"
                variant="ghost"
                className="gap-1.5 text-xs h-7 px-3 text-destructive/70 hover:text-destructive"
                onClick={handleRemoveAvatar}
                disabled={uploading}
              >
                <Trash2 className="w-3 h-3" />
                Remover
              </Button>
            )}
          </div>

          {/* Nome + cargo */}
          <div className="text-center mt-2">
            {editingName ? (
              <div className="flex items-center gap-1.5 px-4">
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Seu nome"
                  onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                  autoFocus
                  className="h-9 text-center font-semibold text-base"
                />
                <Button size="icon" variant="default" className="shrink-0 h-9 w-9" onClick={handleSaveName}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="shrink-0 h-9 w-9" onClick={() => setEditingName(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => { setEditName(profile?.display_name || ''); setEditingName(true); }}
                className="group inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity"
              >
                <h2 className="text-lg font-bold text-foreground">
                  {profile?.display_name || 'Sem nome'}
                </h2>
                <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            )}
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <Shield className="w-3 h-3 text-primary" />
              <span className="text-xs font-medium text-primary">Administrador</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Informações pessoais ── */}
      <div className="mt-4 rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Informações</h3>
        </div>

        <div className="divide-y divide-border">
          {/* Email */}
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">E-mail</p>
              <p className="text-sm font-medium text-foreground truncate">{adminEmail || '—'}</p>
            </div>
          </div>

          {/* Nome de exibição */}
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Nome de exibição</p>
              <p className="text-sm font-medium text-foreground truncate">{profile?.display_name || 'Sem nome'}</p>
            </div>
          </div>

          {/* Membro desde */}
          {profile?.created_at && (
            <div className="flex items-center gap-3 px-5 py-4">
              <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
                <CalendarDays className="w-4 h-4 text-warning" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Membro desde</p>
                <p className="text-sm font-medium text-foreground">
                  {format(new Date(profile.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Histórico de Ações ── */}
      <div className="mt-4 rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Atividade recente
          </h3>
          <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg" onClick={refreshProfile}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>

        {activityLog.length === 0 ? (
          <div className="text-center py-14 px-6">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <Activity className="w-5 h-5 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">Nenhuma ação registrada ainda</p>
          </div>
        ) : (
          <div className="max-h-[380px] overflow-y-auto">
            {activityLog.map((log, i) => (
              <div
                key={log.id}
                className={`flex gap-3 px-5 py-3.5 hover:bg-muted/20 transition-colors ${
                  i < activityLog.length - 1 ? 'border-b border-border/50' : ''
                }`}
              >
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px] shrink-0 mt-0.5">
                  {(log.profile?.display_name || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {log.profile?.display_name || 'Desconhecido'}
                    </span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.created_at), "dd/MM · HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    {ACTION_LABELS[log.action] || log.action}
                  </p>
                  {log.details && Object.keys(log.details).length > 0 && (
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                      {(log.details as any).professionalName &&
                        `Profissional: ${(log.details as any).professionalName}`}
                      {(log.details as any).leaveType &&
                        ` · ${(log.details as any).leaveType}`}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
