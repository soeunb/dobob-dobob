import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webPush from 'npm:web-push@3.6.7';

type PushRequest = {
  kind: 'mission_created' | 'memo_created' | 'memo_reminder';
  household_id: string;
  title: string;
  body: string;
  url?: string;
  source_id?: string;
  target_user_ids?: string[];
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:hello@example.com';
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
      return jsonResponse({ error: 'Missing Supabase or VAPID environment variables.' }, 500);
    }

    const authHeader = req.headers.get('Authorization') || '';
    const caller = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || '', {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: userData, error: userError } = await caller.auth.getUser();

    if (userError || !userData.user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const payload = await req.json() as PushRequest;
    const { data: membership, error: membershipError } = await admin
      .from('household_members')
      .select('household_id,user_id')
      .eq('household_id', payload.household_id)
      .eq('user_id', userData.user.id)
      .maybeSingle();

    if (membershipError || !membership) return jsonResponse({ error: 'Forbidden' }, 403);

    const { data: members, error: memberError } = await admin
      .from('household_members')
      .select('user_id')
      .eq('household_id', payload.household_id);

    if (memberError) throw memberError;

    const allowedTargets = new Set((members || []).map((member) => member.user_id));
    const targetIds = (payload.target_user_ids?.length
      ? payload.target_user_ids
      : [...allowedTargets]).filter((userId) => userId !== userData.user.id && allowedTargets.has(userId));

    if (targetIds.length === 0) return jsonResponse({ sent: 0 });

    const { data: subscriptions, error: subscriptionError } = await admin
      .from('push_subscriptions')
      .select('id,user_id,endpoint,p256dh,auth')
      .in('user_id', targetIds);

    if (subscriptionError) throw subscriptionError;

    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const message = JSON.stringify({
      kind: payload.kind,
      title: payload.title,
      body: payload.body,
      url: payload.url || '/',
      source_id: payload.source_id,
    });

    const results = await Promise.allSettled((subscriptions || []).map((subscription) =>
      webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        message,
      ),
    ));

    return jsonResponse({
      sent: results.filter((result) => result.status === 'fulfilled').length,
      failed: results.filter((result) => result.status === 'rejected').length,
    });
  } catch (error) {
    console.error('[send-push] failed', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
