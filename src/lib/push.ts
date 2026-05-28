import { supabase } from './supabase';

const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;

type PushStatus =
  | 'unsupported'
  | 'missing-key'
  | 'default'
  | 'denied'
  | 'granted';

export type PushNotifyKind = 'mission_created' | 'memo_created' | 'memo_reminder';

export function getPushStatus(): PushStatus {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }

  if (!vapidPublicKey) return 'missing-key';
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function registerPushSubscription() {
  if (!supabase) throw new Error('Supabase 연결을 확인해주세요.');
  const status = getPushStatus();
  if (status === 'unsupported') throw new Error('이 브라우저는 푸시 알림을 지원하지 않아요.');
  if (status === 'missing-key') throw new Error('VITE_VAPID_PUBLIC_KEY 환경변수가 필요해요.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('알림 권한이 꺼져 있어요. 브라우저 설정에서 다시 켜주세요.');
  }

  const registration = await navigator.serviceWorker.register('/sw.js');
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error('푸시 구독 정보를 만들지 못했어요.');
  }

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' },
    );

  if (error) throw error;
  return subscription;
}

export async function notifyHouseholdPush(input: {
  kind: PushNotifyKind;
  householdId: string;
  title: string;
  body: string;
  url?: string;
  sourceId?: string;
}) {
  if (!supabase) return;
  const { error } = await supabase.functions.invoke('send-push', {
    body: {
      kind: input.kind,
      household_id: input.householdId,
      title: input.title,
      body: input.body,
      url: input.url || '/',
      source_id: input.sourceId,
    },
  });

  if (error) throw error;
}
