import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SendPushOptions {
  title: string;
  message: string;
  team_id?: string;
  player_ids?: string[];
  data?: Record<string, any>;
}

export function usePushNotification() {
  const sendPush = useCallback(async (options: SendPushOptions) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: options,
      });

      if (error) {
        console.error('Push notification error:', error);
        return false;
      }

      console.log('Push sent:', data);
      return true;
    } catch (err) {
      console.error('Push notification failed:', err);
      return false;
    }
  }, []);

  return { sendPush };
}
