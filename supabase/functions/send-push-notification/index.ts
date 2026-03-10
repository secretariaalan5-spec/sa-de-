const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const { player_ids, title, message, data: pushData, team_id } = body;

    const ONESIGNAL_APP_ID = 'cba1a85c-c723-4e42-bd22-d3f4d4d07467';
    const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY');

    if (!ONESIGNAL_REST_API_KEY) {
      return new Response(JSON.stringify({ error: 'OneSignal REST API Key not configured' }), { status: 500, headers: corsHeaders });
    }

    let targetPlayerIds = player_ids;

    // If team_id is provided and no specific player_ids, send to all team professionals
    if (team_id && (!player_ids || player_ids.length === 0)) {
      const adminClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const { data: professionals } = await adminClient
        .from('professional_users')
        .select('onesignal_player_id')
        .eq('team_id', team_id)
        .eq('status', 'approved')
        .not('onesignal_player_id', 'is', null);

      targetPlayerIds = (professionals || [])
        .map((p: any) => p.onesignal_player_id)
        .filter(Boolean);
    }

    if (!targetPlayerIds || targetPlayerIds.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: 'No recipients' }), { headers: corsHeaders });
    }

    // Send via OneSignal REST API
    const onesignalRes = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        include_player_ids: targetPlayerIds,
        headings: { en: title || 'Saúde+' },
        contents: { en: message || 'Nova atualização disponível' },
        data: pushData || {},
        url: pushData?.url || undefined,
      }),
    });

    const result = await onesignalRes.json();

    return new Response(JSON.stringify({
      success: true,
      sent: targetPlayerIds.length,
      onesignal_response: result,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: unknown) {
    console.error('Push notification error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: corsHeaders });
  }
});
