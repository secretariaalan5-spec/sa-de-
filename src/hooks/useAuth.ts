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
  // Generation counter to discard stale parallel handleSession calls
  const sessionGenRef = useRef(0);

  const fetchRole = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role, category_id, unit_id, team_id')
        .eq('user_id', userId);

      // Network / RLS error — don't treat as "no role"
      if (error) {
        console.error('fetchRole error:', error.message);
        return false;
      }

      if (data && data.length > 0) {
        const first = data[0];
        const categoryIds = data
          .map((r: any) => r.category_id)
          .filter(Boolean) as string[];
        const teamId =
          data.find((r: any) => r.team_id)?.team_id ?? first.team_id;
        setRoleInfo({
          role: first.role as UserRole,
          category_id: first.category_id,
          category_ids: categoryIds,
          unit_id: first.unit_id,
          team_id: teamId,
        });
        setPendingStatus(null); // Has role = not pending
        return true;
      }
      return false;
    } catch (err) {
      console.error('fetchRole exception:', err);
      return false;
    }
  }, []);

  const fetchPendingStatus = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('pending_approvals')
        .select('status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('fetchPendingStatus error:', error.message);
        return;
      }

      setPendingStatus(data ? (data.status as PendingStatus) : null);
    } catch (err) {
      console.error('fetchPendingStatus exception:', err);
    }
  }, []);

  const processPendingInvite = useCallback(
    async (userId: string) => {
      // Try token from URL path → query string → localStorage
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
          p_token: token,
        });
        if (error) {
          console.error('RPC Error processing invite:', error);
        } else {
          console.log('Invite processed:', data);
        }

        // We do NOT call fetchRole/fetchPendingStatus here anymore.
        // We let handleSession do it right after.
      } catch (err) {
        console.error('Error processing invite:', err);
      } finally {
        // Always clean up to prevent token reuse on account switch
        localStorage.removeItem('pending_invite_token');
        if (window.location.search.includes('token=')) {
          window.history.replaceState({}, '', window.location.pathname);
        }
        if (window.location.pathname.startsWith('/registro/')) {
          window.history.replaceState({}, '', '/');
        }
        processingRef.current = false;
      }
    },
    [],
  );

  useEffect(() => {
    // Each effect run gets its own generation; stale calls are discarded.
    const currentGen = ++sessionGenRef.current;
    let initialSessionHandled = false;

    const handleSession = async (incomingSession: Session | null) => {
      // Discard if a newer handleSession has started
      if (currentGen !== sessionGenRef.current) return;

      setSession(incomingSession);

      if (incomingSession?.user) {
        // ALWAYS try to process any pending invite token available in URL or LocalStorage
        await processPendingInvite(incomingSession.user.id);

        const hasRole = await fetchRole(incomingSession.user.id);
        if (!hasRole) {
          await fetchPendingStatus(incomingSession.user.id);
        }
      } else {
        setRoleInfo(null);
        setPendingStatus(null);
      }

      // Only the first call unlocks the app loading gate
      if (!initialSessionHandled) {
        initialSessionHandled = true;
        setLoading(false);
      }
    };

    // Subscribe FIRST to catch auth events during getSession()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, incomingSession) => {
      // setTimeout defers so getSession() resolves first on initial load
      setTimeout(() => handleSession(incomingSession), 0);
    });

    // Check current session; also handles the loading=false on error
    supabase.auth
      .getSession()
      .then(({ data: { session: s } }) => handleSession(s))
      .catch((err) => {
        console.error('getSession failed:', err);
        setLoading(false); // Unblock app even if session check fails
      });

    return () => {
      subscription.unsubscribe();
      // Bump generation so any in-flight handleSession for this effect is discarded
      sessionGenRef.current++;
    };
  }, [fetchRole, processPendingInvite, fetchPendingStatus]);

  /**
   * Forces a re-fetch of the current user's role.
   * Call this after an RPC that assigns a role (e.g. accept_category_invite)
   * so the UI updates without a full page reload.
   */
  const refreshRole = useCallback(async () => {
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    if (!s?.user) return;
    const hasRole = await fetchRole(s.user.id);
    if (!hasRole) await fetchPendingStatus(s.user.id);
  }, [fetchRole, fetchPendingStatus]);

  const signOut = useCallback(async () => {
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
    refreshRole,
    isAdmin,
    isRH,
    isChief,
    isManager,
    isProfessional,
  };
}
