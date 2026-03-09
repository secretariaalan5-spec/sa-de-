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
import { Users, Search, Trash2, Mail, Briefcase, Calendar, Clock, MapPin, ChevronLeft } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useAppData } from '@/hooks/useAppData';
import { toast } from 'sonner';
import { DAYS_OF_WEEK, PERIODS } from '@/types';
import { cn } from '@/lib/utils';

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
  const { data: appData, getWeeklyHoursUsed } = useAppData();
  const [users, setUsers] = useState<EmultUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<EmultUser | null>(null);
  const [avatarMap, setAvatarMap] = useState<Record<string, string>>({});

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

    if (!error && data) {
      setUsers(data as EmultUser[]);
      const avatars: Record<string, string> = {};
      (data as any[]).forEach(row => {
        if (row.avatar_url) avatars[row.id] = row.avatar_url;
      });
      setAvatarMap(avatars);
    }
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
            <div key={user.id} className="page-card overflow-hidden group cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedUser(user)}>
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
                  onClick={(e) => { e.stopPropagation(); handleRemove(user); }}
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

      {/* Detail Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="bg-card max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Detalhes do Profissional
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (() => {
            // Find matching professional in schedule data
            const prof = appData.professionals.find(p =>
              p.name.toLowerCase() === selectedUser.full_name.toLowerCase() ||
              p.id === selectedUser.professional_id
            );
            const func = prof ? appData.functions.find(f => f.id === prof.functionId) : null;
            const profSchedule = prof ? appData.schedule.filter(s => s.professionalId === prof.id) : [];
            const used = prof ? getWeeklyHoursUsed(prof.id) : 0;
            const limit = prof?.weeklyHours || 0;

            return (
              <div className="space-y-5 mt-2">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-primary-foreground shrink-0 cat-icon-emult">
                    {selectedUser.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-foreground">{selectedUser.full_name}</h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Mail className="w-3.5 h-3.5" />
                      {selectedUser.email}
                    </div>
                    {selectedUser.function_name && (
                      <Badge variant="outline" className="text-primary border-primary">
                        <Briefcase className="w-3 h-3 mr-1" />
                        {selectedUser.function_name}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Briefcase className="w-3.5 h-3.5" />
                      Categoria
                    </div>
                    <Badge variant="secondary" className="cat-text-emult">eMult</Badge>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      Carga Semanal
                    </div>
                    <p className="text-lg font-bold text-foreground">
                      {prof ? (
                        <>
                          <span className={used > limit ? 'text-destructive' : ''}>{used}h</span>
                          <span className="text-muted-foreground font-normal text-sm"> / {limit}h</span>
                        </>
                      ) : (
                        <span className="text-sm text-muted-foreground">Sem escala</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-primary" />
                    Escala Semanal
                  </h4>
                  {profSchedule.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Nenhuma escala definida</p>
                  ) : (
                    <div className="space-y-1.5">
                      {DAYS_OF_WEEK.map(day => {
                        const dayEntries = profSchedule.filter(s => s.dayOfWeek === day.key);
                        if (dayEntries.length === 0) return null;
                        return (
                          <div key={day.key} className="flex items-start gap-2 text-sm">
                            <span className="font-medium text-foreground w-20 shrink-0">{day.label}:</span>
                            <div className="flex flex-wrap gap-1">
                              {dayEntries.map(entry => {
                                const unit = appData.units.find(u => u.id === entry.unitId);
                                const periodLabel = PERIODS.find(p => p.key === entry.period)?.label || entry.period;
                                return (
                                  <Badge key={entry.id} variant="secondary" className="text-xs">
                                    <MapPin className="w-3 h-3 mr-1" />
                                    {unit?.name} – {periodLabel}
                                  </Badge>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                  <span className="font-medium">Cadastrado em:</span>{' '}
                  {new Date(selectedUser.created_at).toLocaleDateString('pt-BR')}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setSelectedUser(null)}>
                    Fechar
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
