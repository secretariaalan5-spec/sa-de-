import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { toast } from 'sonner';

export interface Profile {
  id: string;
  user_id: string;
  team_id: string | null;
  display_name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamInvite {
  id: string;
  team_id: string;
  code: string;
  created_by: string | null;
  used_by: string | null;
  used_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface ActivityLogEntry {
  id: string;
  team_id: string;
  user_id: string;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  profile?: { display_name: string };
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [teamProfiles, setTeamProfiles] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const userId = session.user.id;

    // Fetch or create profile
    let { data: prof, error } = await supabase
      .from('profiles' as any)
      .select('*')
      .eq('user_id', userId)
      .maybeSingle() as any;

    if (error && !prof) {
      // Profile might not exist for existing users - create it
      const { data: newProf } = await supabase
        .from('profiles' as any)
        .insert({
          user_id: userId,
          display_name: session.user.email || '',
        } as any)
        .select()
        .single() as any;

      // If no team, create one
      if (newProf && !newProf.team_id) {
        const { data: team } = await supabase
          .from('teams' as any)
          .insert({ name: 'Minha Equipe', created_by: userId } as any)
          .select()
          .single() as any;

        if (team) {
          await supabase
            .from('profiles' as any)
            .update({ team_id: team.id } as any)
            .eq('user_id', userId) as any;
          newProf.team_id = team.id;
        }
      }
      prof = newProf;
    }

    // Handle existing user with no team
    if (prof && !prof.team_id) {
      const { data: team } = await supabase
        .from('teams' as any)
        .insert({ name: 'Minha Equipe', created_by: userId } as any)
        .select()
        .single() as any;

      if (team) {
        await supabase
          .from('profiles' as any)
          .update({ team_id: team.id } as any)
          .eq('user_id', userId) as any;
        prof.team_id = team.id;
      }
    }

    setProfile(prof as Profile);

    if (prof?.team_id) {
      // Fetch team profiles
      const { data: members } = await supabase
        .from('profiles' as any)
        .select('*')
        .eq('team_id', prof.team_id) as any;
      setTeamProfiles((members || []) as Profile[]);

      // Fetch invites
      const { data: inv } = await supabase
        .from('team_invites' as any)
        .select('*')
        .eq('team_id', prof.team_id)
        .order('created_at', { ascending: false }) as any;
      setInvites((inv || []) as TeamInvite[]);

      // Fetch activity log
      const { data: logs } = await supabase
        .from('activity_log' as any)
        .select('*')
        .eq('team_id', prof.team_id)
        .order('created_at', { ascending: false })
        .limit(50) as any;

      // Enrich with profile names
      const enrichedLogs = ((logs || []) as ActivityLogEntry[]).map(log => {
        const member = (members || []).find((m: Profile) => m.user_id === log.user_id);
        return { ...log, profile: { display_name: member?.display_name || 'Desconhecido' } };
      });
      setActivityLog(enrichedLogs);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = useCallback(async (updates: Partial<Pick<Profile, 'display_name' | 'avatar_url'>>) => {
    if (!profile) return;
    const { error } = await supabase
      .from('profiles' as any)
      .update(updates as any)
      .eq('user_id', profile.user_id) as any;
    if (error) {
      toast.error('Erro ao atualizar perfil');
      return;
    }
    setProfile(prev => prev ? { ...prev, ...updates } : null);
    toast.success('Perfil atualizado!');
  }, [profile]);

  const generateInviteCode = useCallback(async () => {
    if (!profile?.team_id) return;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = 'CONV-' + Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase
      .from('team_invites' as any)
      .insert({
        team_id: profile.team_id,
        code,
        created_by: session?.user?.id,
      } as any)
      .select()
      .single() as any;

    if (error) {
      toast.error('Erro ao gerar código de convite');
      return;
    }
    setInvites(prev => [data as TeamInvite, ...prev]);
    toast.success(`Código gerado: ${code}`);
    return code;
  }, [profile]);

  const joinTeamByCode = useCallback(async (code: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return false;

    // Find invite
    const { data: invite, error: findErr } = await supabase
      .from('team_invites' as any)
      .select('*')
      .eq('code', code.toUpperCase().trim())
      .is('used_by', null)
      .maybeSingle() as any;

    if (findErr || !invite) {
      toast.error('Código de convite inválido ou já utilizado');
      return false;
    }

    if (new Date(invite.expires_at) < new Date()) {
      toast.error('Código de convite expirado');
      return false;
    }

    // Claim invite
    const { error: claimErr } = await supabase
      .from('team_invites' as any)
      .update({ used_by: session.user.id, used_at: new Date().toISOString() } as any)
      .eq('id', invite.id) as any;

    if (claimErr) {
      toast.error('Erro ao usar convite');
      return false;
    }

    // Update profile to join team
    const { error: joinErr } = await supabase
      .from('profiles' as any)
      .update({ team_id: invite.team_id } as any)
      .eq('user_id', session.user.id) as any;

    if (joinErr) {
      toast.error('Erro ao entrar na equipe');
      return false;
    }

    toast.success('Você entrou na equipe!');
    await fetchProfile();
    return true;
  }, [fetchProfile]);

  const logActivity = useCallback(async (action: string, details: Record<string, unknown> = {}) => {
    if (!profile?.team_id) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    await supabase.from('activity_log' as any).insert({
      team_id: profile.team_id,
      user_id: session.user.id,
      action,
      details,
    } as any);
  }, [profile]);

  return {
    profile,
    teamProfiles,
    invites,
    activityLog,
    loading,
    updateProfile,
    generateInviteCode,
    joinTeamByCode,
    logActivity,
    refreshProfile: fetchProfile,
  };
}
