import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { Session } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'category_chief' | 'unit_manager' | 'rh' | 'professional';

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
      return true;
    }
    return false;
  }, []);

  const processPendingInvite = useCallback(async (userId: string) => {
    // Try to get token from URL params first (robust for mobile redirects), then pathname, then fallback to localStorage
    const urlParams = new URLSearchParams(window.location.search);
    let token = urlParams.get('token');
    
    if (!token && window.location.pathname.startsWith('/registro/')) {
      token = window.location.pathname.split('/registro/')[1];
    }
    
    if (!token) {
      token = localStorage.getItem('pending_invite_token');
    }

    if (!token || processingRef.current) return;
    processingRef.current = true;

    try {
      const { data: invite } = await supabase
        .from('invites')
        .select('*')
        .eq('token', token)
        .eq('used', false)
        .maybeSingle();

      if (!invite) {
        localStorage.removeItem('pending_invite_token');
        return;
      }

      // For category_chief, allow adding new category even if user already has a role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id, role, category_id')
        .eq('user_id', userId);

      const hasExactRole = (existingRole ?? []).some((r: any) =>
        r.role === invite.role && r.category_id === invite.category_id
      );

      if (hasExactRole) {
        localStorage.removeItem('pending_invite_token');
        await fetchRole(userId);
        return;
      }

      // If user has a different role (not category_chief adding category), skip
      if (existingRole && existingRole.length > 0 && invite.role !== 'category_chief') {
        const hasOtherRole = existingRole.some((r: any) => r.role !== invite.role);
        if (hasOtherRole) {
          localStorage.removeItem('pending_invite_token');
          await fetchRole(userId);
          return;
        }
      }

      await supabase.from('user_roles').insert({
        user_id: userId,
        role: invite.role,
        team_id: invite.team_id,
        category_id: invite.category_id,
        unit_id: invite.unit_id,
      });

      await supabase
        .from('profiles')
        .update({ team_id: invite.team_id } as any)
        .eq('user_id', userId);

      await supabase
        .from('invites')
        .update({ used: true, used_by: userId } as any)
        .eq('id', invite.id);

      await fetchRole(userId);
    } catch (err) {
      console.error('Error processing invite:', err);
    } finally {
      localStorage.removeItem('pending_invite_token');

      // Also clean up the token from the URL to avoid reprocessing
      if (window.location.search.includes('token=')) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      processingRef.current = false;
    }
  }, [fetchRole]);

  useEffect(() => {
    let initialSessionHandled = false;

    // Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        setTimeout(() => {
          fetchRole(session.user.id).then(hasRole => {
            if (!hasRole) {
              processPendingInvite(session.user.id);
            }
            // If getSession hasn't resolved yet, mark loading done here
            if (!initialSessionHandled) {
              initialSessionHandled = true;
              setLoading(false);
            }
          });
        }, 0);
      } else {
        setRoleInfo(null);
        if (!initialSessionHandled) {
          initialSessionHandled = true;
          setLoading(false);
        }
      }
    });

    // Then check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchRole(session.user.id).then(hasRole => {
          if (!hasRole) {
            processPendingInvite(session.user.id);
          }
          if (!initialSessionHandled) {
            initialSessionHandled = true;
            setLoading(false);
          }
        });
      } else {
        if (!initialSessionHandled) {
          initialSessionHandled = true;
          setLoading(false);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchRole, processPendingInvite]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setRoleInfo(null);
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
    loading,
    signOut,
    isAdmin,
    isRH,
    isChief,
    isManager,
    isProfessional,
  };
}
