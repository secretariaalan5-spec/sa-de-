import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';
import { Session } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'category_chief' | 'unit_manager' | 'rh' | 'professional';

export interface UserRoleInfo {
  role: UserRole;
  category_id: string | null;
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
      .eq('user_id', userId)
      .maybeSingle();

    if (data) {
      setRoleInfo({
        role: data.role as UserRole,
        category_id: data.category_id,
        unit_id: data.unit_id,
        team_id: data.team_id,
      });
      return true;
    }
    return false;
  }, []);

  const processPendingInvite = useCallback(async (userId: string) => {
    const token = localStorage.getItem('pending_invite_token');
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

      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existingRole) {
        localStorage.removeItem('pending_invite_token');
        await fetchRole(userId);
        return;
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
      processingRef.current = false;
    }
  }, [fetchRole]);

  useEffect(() => {
    // Set up listener FIRST — no awaits inside callback
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        // Fire and forget — don't block auth state
        setTimeout(() => {
          fetchRole(session.user.id).then(hasRole => {
            if (!hasRole) {
              processPendingInvite(session.user.id);
            }
          });
        }, 0);
      } else {
        setRoleInfo(null);
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
          setLoading(false);
        });
      } else {
        setLoading(false);
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
