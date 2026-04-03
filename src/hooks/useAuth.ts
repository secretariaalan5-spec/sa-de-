import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { Session } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'category_chief' | 'unit_manager' | 'rh' | 'professional';
export type PendingStatus = 'pending' | 'approved' | 'rejected' | null;

export interface UserRoleInfo {
  role: UserRole;
  category_id: string | null;
  category_ids: string[];
  unit_id: string | null;
  team_id: string | null;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [roleInfo, setRoleInfo] = useState<UserRoleInfo | null>(null);
  const [pendingStatus, setPendingStatus] = useState<PendingStatus>(null);
  const [loading, setLoading] = useState(true);
  const processingRef = useRef(false);

  const fetchRole = useCallback(async (userId: string): Promise<boolean> => {
    const { data } = await supabase
      .from('user_roles')
      .select('role, category_id, unit_id, team_id')
      .eq('user_id', userId);

    if (data && data.length > 0) {
      const first = data[0];
      const categoryIds = data.map((r: any) => r.category_id).filter(Boolean) as string[];
      const teamId = data.find((r: any) => r.team_id)?.team_id ?? first.team_id;
      setRoleInfo({
        role: first.role as UserRole,
        category_id: first.category_id,
        category_ids: categoryIds,
        unit_id: first.unit_id,
        team_id: teamId,
      });
      setPendingStatus(null); // Has role = no pending
      return true;
    }
    return false;
  }, []);

  const fetchPendingStatus = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('pending_approvals')
      .select('status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setPendingStatus(data.status as PendingStatus);
    } else {
      setPendingStatus(null);
    }
  }, []);

  const processPendingInvite = useCallback(async (userId: string) => {
    // Try to get token from URL pathname first, then localStorage
    let token: string | null = null;

    if (window.location.pathname.startsWith('/registro/')) {
      token = window.location.pathname.split('/registro/')[1];
    }

    if (!token) {
      const urlParams = new URLSearchParams(window.location.search);
      token = urlParams.get('token');
    }

    if (!token) {
      token = localStorage.getItem('pending_invite_token');
    }

    if (!token || processingRef.current) return;
    processingRef.current = true;

    try {
      const { data, error } = await supabase.rpc('accept_invite_by_token', {
        p_token: token
      });

      if (error) {
        console.error('RPC Error processing invite:', error);
      } else {
        console.log('Invite processed:', data);
      }

      // After processing, check if user got a role (admin pre-approved) or is pending
      const hasRole = await fetchRole(userId);
      if (!hasRole) {
        await fetchPendingStatus(userId);
      }
    } catch (err) {
      console.error('Error processing invite:', err);
    } finally {
      // ALWAYS clean up token immediately to prevent account switching
      localStorage.removeItem('pending_invite_token');

      if (window.location.search.includes('token=')) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      processingRef.current = false;
    }
  }, [fetchRole, fetchPendingStatus]);

  useEffect(() => {
    let initialSessionHandled = false;

    const handleSession = async (session: Session | null) => {
      setSession(session);
      if (session?.user) {
        const hasRole = await fetchRole(session.user.id);
        if (!hasRole) {
          await processPendingInvite(session.user.id);
          // If still no role after processing invite, check pending status
          const hasRoleNow = await fetchRole(session.user.id);
          if (!hasRoleNow) {
            await fetchPendingStatus(session.user.id);
          }
        }
      } else {
        setRoleInfo(null);
        setPendingStatus(null);
      }
      if (!initialSessionHandled) {
        initialSessionHandled = true;
        setLoading(false);
      }
    };

    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => handleSession(session), 0);
    });

    // Then check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, [fetchRole, processPendingInvite, fetchPendingStatus]);

  const signOut = useCallback(async () => {
    // Clear ALL sensitive data on logout
    localStorage.removeItem('pending_invite_token');
    await supabase.auth.signOut();
    setSession(null);
    setRoleInfo(null);
    setPendingStatus(null);
  }, []);

  const isAdmin = roleInfo?.role === 'admin';
  const isRH = roleInfo?.role === 'rh';
  const isChief = roleInfo?.role === 'category_chief';
  const isManager = roleInfo?.role === 'unit_manager';
  const isProfessional = roleInfo?.role === 'professional';

  return {
    session,
    user: session?.user ?? null,
    roleInfo,
    pendingStatus,
    loading,
    signOut,
    isAdmin,
    isRH,
    isChief,
    isManager,
    isProfessional,
  };
}
