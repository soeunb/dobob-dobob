import { supabase } from './supabase';

type HqLogLevel = 'info' | 'warn' | 'error';
type HqLogCategory = 'frontend' | 'api' | 'save' | 'auth' | 'db' | 'ui' | 'test';

type LogToHqInput = {
  level: HqLogLevel;
  category: HqLogCategory;
  message: string;
  action?: string;
  detail?: unknown;
  page?: string;
  userId?: string;
  sessionId?: string;
  memo?: string;
};

export async function logToHq(input: LogToHqInput): Promise<boolean> {
  if (!supabase) {
    if (import.meta.env.DEV) {
      console.warn('[logToHq] Supabase is not configured.');
    }
    return false;
  }

  try {
    const { error } = await supabase.functions.invoke('log-to-hq', {
      body: {
        level: input.level,
        category: input.category,
        action: input.action ?? null,
        message: input.message,
        detail: normalizeDetail(input.detail),
        page: input.page ?? null,
        user_id: input.userId ?? null,
        session_id: input.sessionId ?? null,
        memo: input.memo ?? null,
      },
    });

    if (error) {
      console.warn('[logToHq] HQ log function failed.', error);
      return false;
    }

    return true;
  } catch (error) {
    console.warn('[logToHq] HQ log function error.', error);
    return false;
  }
}

function normalizeDetail(detail: unknown) {
  if (!detail) {
    return null;
  }

  if (detail instanceof Error) {
    return {
      name: detail.name,
      message: detail.message,
      stack: detail.stack,
    };
  }

  return detail;
}
