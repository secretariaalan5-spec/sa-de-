import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface TeamMember {
  id: string;
  owner_id: string;
  member_email: string;
  member_id: string | null;
  role: string | null;
  status: string | null;
  invited_at: string | null;
  accepted_at: string | null;
  permissions: Record<string, boolean>;
  team_id: string | null;
}

export function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('team_members' as any)
      .select('*')
      .eq('owner_id', user.id) as any;

    if (!error && data) {
      setMembers(data as TeamMember[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const inviteMember = useCallback(async (email: string, permissions: Record<string, boolean>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Get user's team_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('team_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const { error } = await supabase
      .from('team_members' as any)
      .insert({
        owner_id: user.id,
        member_email: email.toLowerCase().trim(),
        role: 'member',
        status: 'pending',
        permissions,
        team_id: profile?.team_id || null,
      } as any);

    if (error) {
      if (error.code === '23505') {
        toast.error('Este e-mail já foi convidado.');
      } else {
        toast.error('Erro ao convidar membro.');
        console.error(error);
      }
      return false;
    }

    toast.success(`Convite enviado para ${email}`);
    await fetchMembers();
    return true;
  }, [fetchMembers]);

  const updateMemberPermissions = useCallback(async (memberId: string, permissions: Record<string, boolean>) => {
    const { error } = await supabase
      .from('team_members' as any)
      .update({ permissions } as any)
      .eq('id', memberId) as any;

    if (error) {
      toast.error('Erro ao atualizar permissões.');
      return false;
    }

    toast.success('Permissões atualizadas!');
    await fetchMembers();
    return true;
  }, [fetchMembers]);

  const removeMember = useCallback(async (memberId: string) => {
    const { error } = await supabase
      .from('team_members' as any)
      .delete()
      .eq('id', memberId) as any;

    if (error) {
      toast.error('Erro ao remover membro.');
      return false;
    }

    toast.success('Membro removido.');
    await fetchMembers();
    return true;
  }, [fetchMembers]);

  return { members, loading, inviteMember, updateMemberPermissions, removeMember, refresh: fetchMembers };
}
