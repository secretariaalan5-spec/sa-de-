/**
 * EmultProfessionals — Lista de profissionais eMult aprovados.
 *
 * Exibe cards com cor de categoria e função/profissão vinculada.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Users, Search, Trash2, Mail, Briefcase, User, Calendar, Clock, MapPin } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useAppData } from '@/hooks/useAppData';
import { toast } from 'sonner';
import { DAYS_OF_WEEK, PERIODS } from '@/types';

interface EmultUser {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  professional_id: string | null;
  team_id: string | null;
  category: string;
  status: string;
  function_name: string | null;
  created_at: string;
}

export default function EmultProfessionals() {
  const { profile } = useProfile();
  const [users, setUsers] = useState<EmultUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchEmultUsers = useCallback(async () => {
    if (!profile?.team_id) return;
    setLoading(true);

    const { data, error } = await (supabase
      .from('professional_users' as any)
      .select('*')
      .eq('team_id', profile.team_id)
      .eq('category', 'emult')
      .eq('status', 'approved')
      .order('full_name', { ascending: true }) as any);

    if (!error && data) setUsers(data as EmultUser[]);
    setLoading(false);
  }, [profile?.team_id]);

  useEffect(() => { fetchEmultUsers(); }, [fetchEmultUsers]);

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return users;
    const term = searchTerm.toLowerCase();
    return users.filter(u =>
      u.full_name.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      (u.function_name || '').toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  const handleRemove = async (user: EmultUser) => {
    if (!confirm(`Remover ${user.full_name} da equipe eMult?`)) return;

    const { error } = await (supabase
      .from('professional_users' as any)
      .delete()
      .eq('id', user.id) as any);

    if (error) {
      toast.error('Erro ao remover profissional');
      return;
    }

    toast.success(`${user.full_name} removido(a).`);
    fetchEmultUsers();
  };

  return (
    <div className="animate-fade-in space-y-6 max-w-4xl">
      <PageHeader
        title="Profissionais eMult"
        description="Profissionais aprovados na categoria eMult"
      />

      <div className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, e-mail ou função..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-11 bg-card shadow-sm"
        />
      </div>

      {loading ? (
        <div className="empty-state">
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={users.length === 0 ? 'Nenhum profissional eMult aprovado' : 'Nenhum resultado encontrado'}
          description="Profissionais eMult são aprovados na página de Links & Aprovações."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(user => (
            <div key={user.id} className="page-card overflow-hidden group">
              <div className="h-1 -mx-5 -mt-5 mb-4 cat-bar-emult" />

              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 cat-icon-emult">
                  <Users className="w-4 h-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-sm text-foreground truncate">{user.full_name}</h3>
                  {user.function_name && (
                    <div className="flex items-center gap-1 text-xs text-primary font-medium truncate">
                      <Briefcase className="w-3 h-3 shrink-0" />
                      <span className="truncate">{user.function_name}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                    <Mail className="w-3 h-3 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] mt-1 cat-text-emult">eMult</Badge>
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemove(user)}
                  title="Remover profissional"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {filtered.length} profissional(is) eMult
      </p>
    </div>
  );
}
