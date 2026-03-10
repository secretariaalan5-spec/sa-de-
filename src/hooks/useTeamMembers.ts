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

export interface PendingManagerRequest {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  category: string;
  status: string;
  created_at: string;
}

export function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingManagerRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('team_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!profile?.team_id) {
      setLoading(false);
      return;
    }

    // Fetch confirmed team members
    const { data: membersData, error: membersError } = await supabase
      .from('team_members' as any)
      .select('*')
      .eq('team_id', profile.team_id) as any;

    if (!membersError && membersData) {
      setMembers(membersData as TeamMember[]);
    }

    // Fetch pending manager requests from professional_users
    const { data: requestsData, error: requestsError } = await supabase
      .from('professional_users' as any)
      .select('*')
      .eq('team_id', profile.team_id)
      .eq('category', 'manager')
      .eq('status', 'pending') as any;

    if (!requestsError && requestsData) {
      setPendingRequests(requestsData as PendingManagerRequest[]);
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
    // Also remove from professional_users if linked
    const memberToRemove = members.find(m => m.id === memberId);

    const { error } = await supabase
      .from('team_members' as any)
      .delete()
      .eq('id', memberId) as any;

    if (error) {
      toast.error('Erro ao remover membro.');
      return false;
    }

    if (memberToRemove?.member_id) {
      await supabase
        .from('professional_users' as any)
        .delete()
        .eq('user_id', memberToRemove.member_id);
    }

    toast.success('Membro removido.');
    await fetchMembers();
    return true;
  }, [fetchMembers, members]);

  const approveManagerRequest = useCallback(async (requestId: string, permissions: Record<string, boolean>) => {
    const request = pendingRequests.find(r => r.id === requestId);
    if (!request) return false;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // 1. Update status in professional_users
    const { error: updateError } = await supabase
      .from('professional_users' as any)
      .update({ status: 'approved' } as any)
      .eq('id', requestId) as any;

    if (updateError) {
      toast.error('Erro ao aprovar solicitação.');
      return false;
    }

    // 2. Add to team_members
    const { data: profile } = await supabase
      .from('profiles')
      .select('team_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const { error: insertError } = await supabase
      .from('team_members' as any)
      .insert({
        owner_id: user.id,
        member_id: request.user_id,
        member_email: request.email,
        role: 'member',
        status: 'accepted',
        permissions,
        team_id: profile?.team_id,
        accepted_at: new Date().toISOString()
      } as any);

    if (insertError) {
      console.error('Insert team_member error:', insertError);
      toast.error('Solicitação aprovada em professional_users, mas erro ao criar registro de membro.');
    } else {
      toast.success(`${request.full_name} agora é um gestor da equipe!`);
    }

    await fetchMembers();
    return true;
  }, [fetchMembers, pendingRequests]);

  const rejectManagerRequest = useCallback(async (requestId: string) => {
    const { error } = await supabase
      .from('professional_users' as any)
      .update({ status: 'rejected' } as any)
      .eq('id', requestId) as any;

    if (error) {
      toast.error('Erro ao rejeitar solicitação.');
      return false;
    }

    toast.success('Solicitação rejeitada.');
    await fetchMembers();
    return true;
  }, [fetchMembers]);

  return {
    members,
    pendingRequests,
    loading,
    inviteMember,
    updateMemberPermissions,
    removeMember,
    approveManagerRequest,
    rejectManagerRequest,
    refresh: fetchMembers
  };
}
