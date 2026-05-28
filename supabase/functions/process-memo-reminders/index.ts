import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webPush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const cronSecret = Deno.env.get('CRON_SECRET');
  if (cronSecret && req.headers.get('x-cron-secret') !== cronSecret) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:hello@example.com';
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey) {
      return jsonResponse({ error: 'Missing Supabase or VAPID environment variables.' }, 500);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: reminders, error: reminderError } = await admin
      .from('memo_reminders')
      .select('id,memo_id,household_id,sender_id,target_user_ids,remind_at')
      .eq('status', 'pending')
      .lte('remind_at', new Date().toISOString())
      .limit(25);

    if (reminderError) throw reminderError;

    webPush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const reminder of reminders || []) {
      const { data: memo } = await admin
        .from('fridge_memos')
        .select('id,text')
        .eq('id', reminder.memo_id)
        .maybeSingle();

      if (!memo) {
        skipped += 1;
        await admin.from('memo_reminders').update({ status: 'skipped', updated_at: new Date().toISOString() }).eq('id', reminder.id);
        continue;
      }

      const { data: sender } = await admin
        .from('profiles')
        .select('display_name')
        .eq('id', reminder.sender_id)
        .maybeSingle();

      const { data: members, error: memberError } = await admin
        .from('household_members')
        .select('user_id')
        .eq('household_id', reminder.household_id);

      if (memberError) throw memberError;

      const allowedTargets = new Set((members || []).map((member) => member.user_id));
      const targetIds = ((reminder.target_user_ids?.length ? reminder.target_user_ids : [...allowedTargets]) as string[])
        .filter((userId) => userId !== reminder.sender_id && allowedTargets.has(userId));

      const { data: subscriptions, error: subscriptionError } = targetIds.length > 0
        ? await admin.from('push_subscriptions').select('endpoint,p256dh,auth').in('user_id', targetIds)
        : { data: [], error: null };

      if (subscriptionError) throw subscriptionError;

      const message = JSON.stringify({
        kind: 'memo_reminder',
        title: `${sender?.display_name || '가족'}님이 남긴 메모를 확인해보세요`,
        body: memo.text,
        url: '/',
        source_id: memo.id,
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

      sent += results.filter((result) => result.status === 'fulfilled').length;
      failed += results.filter((result) => result.status === 'rejected').length;

      await admin
        .from('memo_reminders')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', reminder.id);
    }

    return jsonResponse({ processed: reminders?.length || 0, sent, skipped, failed });
  } catch (error) {
    console.error('[process-memo-reminders] failed', error);
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unknown error' }, 500);
  }
});
