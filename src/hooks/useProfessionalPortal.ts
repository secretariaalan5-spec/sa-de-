import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session } from '@supabase/supabase-js';
import { toast } from 'sonner';

export interface ProfessionalUser {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  professional_id: string | null;
  team_id: string | null;
  category: string;
  status: string;
  created_at: string;
}

export interface ProfessionalLeaveRequest {
  id: string;
  user_id: string;
  professional_id: string;
  team_id: string;
  category: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  observations: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

export function useProfessionalPortal() {
  const [session, setSession] = useState<Session | null>(null);
  const [professionalUser, setProfessionalUser] = useState<ProfessionalUser | null>(null);
  const [leaveRequests, setLeaveRequests] = useState<ProfessionalLeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

  // Listen to auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch professional user record
  const fetchProfessionalUser = useCallback(async () => {
    if (!session?.user) {
      setProfessionalUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await (supabase
        .from('professional_users' as any)
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle() as any);

      if (error && error.code !== 'PGRST116') throw error;
      setProfessionalUser(data as ProfessionalUser | null);
    } catch (err) {
      console.error('Error fetching professional user:', err);
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    fetchProfessionalUser();
  }, [fetchProfessionalUser]);

  // Register as professional using server-side RPC
  const registerProfessional = useCallback(async (teamId: string, category: string, fullName?: string) => {
    if (!session?.user) return false;

    const nameToUse = fullName?.trim() || session.user.user_metadata?.full_name || session.user.email || '';

    try {
      const { error } = await supabase.rpc('register_professional_via_portal' as any, {
        _team_id: teamId,
        _category: category,
        _full_name: nameToUse,
        _email: session.user.email || '',
      } as any);

      if (error) throw error;

      toast.success('Solicitação enviada! Aguarde aprovação do administrador.');
      await fetchProfessionalUser();
      return true;
    } catch (err: any) {
      if (err.code === '23505') {
        toast.error('Você já possui um registro. Atualize a página.');
      } else {
        toast.error('Erro ao registrar: ' + (err.message || ''));
      }
      return false;
    }
  }, [session, fetchProfessionalUser]);

  // Fetch leave requests
  const fetchLeaveRequests = useCallback(async () => {
    if (!session?.user) return;

    const { data, error } = await (supabase
      .from('professional_leave_requests' as any)
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false }) as any);

    if (!error && data) {
      setLeaveRequests(data as ProfessionalLeaveRequest[]);
    }
  }, [session]);

  useEffect(() => {
    if (professionalUser?.status === 'approved') {
      fetchLeaveRequests();
    }
  }, [professionalUser, fetchLeaveRequests]);

  // Submit leave request
  const submitLeaveRequest = useCallback(async (request: {
    leave_type: string;
    start_date: string;
    end_date: string;
    days_requested: number;
    observations?: string;
  }) => {
    if (!session?.user || !professionalUser?.professional_id || !professionalUser?.team_id) {
      toast.error('Dados incompletos para enviar o pedido.');
      return false;
    }

    try {
      const { error } = await (supabase
        .from('professional_leave_requests' as any)
        .insert({
          user_id: session.user.id,
          professional_id: professionalUser.professional_id,
          team_id: professionalUser.team_id,
          category: professionalUser.category,
          ...request,
        } as any) as any);

      if (error) throw error;

      toast.success('Pedido de folga enviado! Aguarde aprovação.');
      await fetchLeaveRequests();
      return true;
    } catch (err: any) {
      toast.error('Erro ao enviar pedido: ' + (err.message || ''));
      return false;
    }
  }, [session, professionalUser, fetchLeaveRequests]);

  // Google login
  const loginWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.href,
      },
    });
    if (error) toast.error('Erro ao entrar com Google: ' + error.message);
  }, []);

  // Logout
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setProfessionalUser(null);
    setLeaveRequests([]);
  }, []);

  return {
    session,
    professionalUser,
    leaveRequests,
    loading: loading || authLoading,
    loginWithGoogle,
    logout,
    registerProfessional,
    submitLeaveRequest,
    refreshLeaveRequests: fetchLeaveRequests,
    refreshProfile: fetchProfessionalUser,
  };
}
