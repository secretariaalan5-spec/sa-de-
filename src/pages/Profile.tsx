import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { useAuthContext } from '@/contexts/AuthContext';
import { useDataSubscription } from '@/hooks/useDataSubscription';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Camera, User, Mail, Shield, Save, Image as ImageIcon, Trash2 } from 'lucide-react';

export default function Profile() {
  const { user, roleInfo, loading } = useAuthContext();
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const roleLabels: Record<string, string> = {
    admin: 'Administrador',
    rh: 'RH',
    category_chief: 'Chefe de Categoria',
    unit_manager: 'Gerente de Unidade',
    professional: 'Profissional',
  };

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) {
      setDisplayName(data.display_name || '');
      setAvatarUrl(data.avatar_url);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  useDataSubscription(['profiles'], (payload) => {
    if (payload.new && payload.new.user_id === user?.id) {
      load();
    }
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 10MB.');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;

      // Limpar fotos antigas
      const { data: oldFiles } = await supabase.storage.from('avatars').list(user.id);
      if (oldFiles && oldFiles.length > 0) {
        await supabase.storage.from('avatars').remove(oldFiles.map(f => `${user.id}/${f.name}`));
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = `${publicUrl}?t=${Date.now()}`;

      await supabase.from('profiles').update({ avatar_url: url }).eq('user_id', user.id);
      setAvatarUrl(url);
      toast.success('Foto atualizada!');
    } catch {
      toast.error('Erro ao enviar imagem.');
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleDeleteAvatar = async () => {
    if (!user) return;
    setUploading(true);
    try {
      const { data: files } = await supabase.storage.from('avatars').list(user.id);
      if (files && files.length > 0) {
        await supabase.storage.from('avatars').remove(files.map(f => `${user.id}/${f.name}`));
      }
      await supabase.from('profiles').update({ avatar_url: null }).eq('user_id', user.id);
      setAvatarUrl(null);
      toast.success('Foto removida!');
    } catch {
      toast.error('Erro ao remover foto.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() })
      .eq('user_id', user.id);
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar perfil.');
      return;
    }
    toast.success('Perfil salvo!');
  };

  const initials = (displayName || user?.email || 'U').substring(0, 2).toUpperCase();

  return (
    <div className="max-w-lg mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold">Meu Perfil</h1>

      <div className="page-card flex flex-col items-center gap-4 py-8">
        <div className="relative group">
          <Avatar className="h-24 w-24 border-4 border-primary/20">
            {avatarUrl ? (
              <AvatarImage src={avatarUrl} alt="Avatar" />
            ) : null}
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
              {initials}
            </AvatarFallback>
          </Avatar>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                disabled={uploading}
                className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Camera size={24} className="text-white" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuItem onClick={() => cameraRef.current?.click()} className="gap-2 cursor-pointer">
                <Camera size={16} /> Tirar Foto
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileRef.current?.click()} className="gap-2 cursor-pointer">
                <ImageIcon size={16} /> Escolher Foto
              </DropdownMenuItem>
              {avatarUrl && (
                <DropdownMenuItem onClick={handleDeleteAvatar} className="gap-2 text-destructive focus:text-destructive cursor-pointer">
                  <Trash2 size={16} /> Excluir Foto
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleUpload} />
        </div>
        {uploading && <p className="text-xs text-muted-foreground">Enviando...</p>}
        <p className="text-sm font-medium">
          {roleInfo?.role ? roleLabels[roleInfo.role] : (loading ? 'Carregando...' : 'Sem Permissão')}
        </p>
      </div>

      <div className="page-card space-y-4">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-2"><User size={14} /> Nome de exibição</Label>
          <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Seu nome" />
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-2"><Mail size={14} /> E-mail</Label>
          <Input value={user?.email ?? ''} disabled className="bg-muted" />
        </div>

        <div className="space-y-1.5">
          <Label className="flex items-center gap-2"><Shield size={14} /> Função</Label>
          <Input
            value={roleInfo?.role ? roleLabels[roleInfo.role] : (loading ? 'Carregando...' : 'Sem Permissão')}
            disabled
            className="bg-muted"
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
          <Save size={16} /> {saving ? 'Salvando...' : 'Salvar Perfil'}
        </Button>
      </div>
    </div>
  );
}
