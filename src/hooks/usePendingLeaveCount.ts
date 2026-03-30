import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/untyped-client';

/**
 * Returns the count of pending portal leave requests for the admin's team.
 * Subscribes to realtime changes for instant updates.
 */
export function usePendingLeaveCount() {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('team_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile?.team_id) return;

      const { count: pending, error } = await supabase
        .from('professional_leave_requests')
        .select('id', { count: 'exact', head: true })
        .eq('team_id', profile.team_id)
        .eq('status', 'pending');

      if (!error && pending !== null) {
        setCount(pending);
      }
    } catch (err) {
      console.error('Error fetching pending leave count:', err);
    }
  }, []);

  useEffect(() => {
    fetchCount();

    const channel = supabase
      .channel('pending-leaves-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'professional_leave_requests' },
        () => fetchCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCount]);

  return count;
}
