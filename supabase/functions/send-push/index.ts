import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

// VAPID keys for Web Push
const VAPID_PUBLIC_KEY = 'BBGLZRD35eG-gEMum5k69VTv0lQEo9euZUbvsHHyCzxpBbkrE-mYvCxCypoS2uynz7ZjHq7Xf-yhzM34p8RJCIM';
const VAPID_PRIVATE_KEY = '9k3iW8pUQJy6_qVnM14ICrh3p3b_j0B0iX7GO8ldlVU';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

webpush.setVapidDetails(
  'mailto:saude-plus@noreply.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

Deno.serve(async (req: Request) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    const body = await req.json();
    
    // Support webhook format (record field) and direct call
    const record = body.record || body;
    const userId = record.user_id;
    const title = record.title || 'Saúde+';
    const message = record.message || 'Nova notificação';
    const url = record.link || record.url || '/';

    if (!userId) {
      return new Response(JSON.stringify({ error: 'user_id required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get push subscriptions for this user
    const { data: subs, error: subErr } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (subErr) {
      console.error('DB error:', subErr);
      return new Response(JSON.stringify({ error: subErr.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no_subscriptions' }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }

    // Busca total de notificações não lidas para exibir a quantidade na notificação nativa
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    const countNumber = (unreadCount && unreadCount > 0) ? unreadCount : 1;
    const countSuffix = countNumber > 1 ? ` (${countNumber} pendentes)` : '';
    const formattedTitle = `${title}${countSuffix}`;

    const payload = JSON.stringify({
      title: formattedTitle,
      body: message,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url, unreadCount: countNumber },
      vibrate: [200, 100, 200],
      tag: record.tag || 'saude-alert-latest',
      renotify: true,
      requireInteraction: true, // Notificação persistente no Windows / Android até o usuário clicar ou fechar no X
    });

    let sent = 0;
    const expired: string[] = [];

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth_key,
            },
          },
          payload,
          { TTL: 86400, urgency: 'high' }
        );
        sent++;
        console.log('Push sent to', sub.endpoint.slice(0, 60));
      } catch (err: any) {
        // 404/410 = token expirado/cancelado; 403 = token criado com outra chave VAPID (ex.: OneSignal antigo)
        // Todos são permanentes: removemos para não poluir e para o app recriar na próxima abertura.
        if (err.statusCode === 410 || err.statusCode === 404 || err.statusCode === 403) {
          expired.push(sub.id);
          console.log('Subscription invalid', err.statusCode, sub.endpoint.slice(0, 60));
        } else {
          console.error('Push error:', err.statusCode, err.message, sub.endpoint.slice(0, 60));
        }
      }
    }

    // Remove expired subscriptions
    if (expired.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', expired);
    }

    return new Response(
      JSON.stringify({ sent, expired: expired.length, total_subs: subs.length }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (e: any) {
    console.error('Edge function error:', e);
    return new Response(
      JSON.stringify({ error: e.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
});
