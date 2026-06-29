type HqLogLevel = 'info' | 'warn' | 'error';
type HqLogCategory = 'frontend' | 'api' | 'save' | 'auth' | 'db' | 'ui' | 'test';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const levels = new Set<HqLogLevel>(['info', 'warn', 'error']);
const categories = new Set<HqLogCategory>(['frontend', 'api', 'save', 'auth', 'db', 'ui', 'test']);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const endpoint = Deno.env.get('DOBAB_HQ_LOG_ENDPOINT');
  const secret = Deno.env.get('DOBAB_HQ_LOG_SECRET');

  if (!endpoint || !secret) {
    return jsonResponse({ error: 'Missing DOBAB_HQ_LOG_ENDPOINT or DOBAB_HQ_LOG_SECRET.' }, 500);
  }

  const body = await req.json().catch(() => null);
  const parsed = parseLogPayload(body);

  if (!parsed.ok) {
    return jsonResponse({ error: parsed.error }, 400);
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(parsed.value),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return jsonResponse({ error: 'HQ log request failed.', status: response.status, body: text }, 502);
    }

    const data = await response.json().catch(() => ({}));
    return jsonResponse({ ok: true, data }, 200);
  } catch (error) {
    return jsonResponse({ error: 'HQ log request error.', detail: String(error) }, 502);
  }
});

function parseLogPayload(payload: unknown):
  | {
      ok: true;
      value: {
        level: HqLogLevel;
        category: HqLogCategory;
        action: string | null;
        message: string;
        detail: unknown;
        page: string | null;
        user_id: string | null;
        session_id: string | null;
        memo: string | null;
      };
    }
  | { ok: false; error: string } {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'JSON body is required.' };
  }

  const source = payload as Record<string, unknown>;
  const level = source.level;
  const category = source.category;
  const message = source.message;

  if (typeof level !== 'string' || !levels.has(level as HqLogLevel)) {
    return { ok: false, error: 'Invalid level.' };
  }

  if (typeof category !== 'string' || !categories.has(category as HqLogCategory)) {
    return { ok: false, error: 'Invalid category.' };
  }

  if (typeof message !== 'string' || message.trim().length === 0) {
    return { ok: false, error: 'message is required.' };
  }

  return {
    ok: true,
    value: {
      level: level as HqLogLevel,
      category: category as HqLogCategory,
      action: nullableString(source.action),
      message: message.trim(),
      detail: source.detail ?? null,
      page: nullableString(source.page),
      user_id: nullableString(source.user_id),
      session_id: nullableString(source.session_id),
      memo: nullableString(source.memo),
    },
  };
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'content-type': 'application/json',
    },
  });
}
