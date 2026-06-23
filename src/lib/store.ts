import { supabase } from './supabase';
import { FavoriteInput, FridgeMemo, FridgeMemoInput, Household, MealInput, MealMission, MealSlot, MemoReminder, MenuTemplate, Profile } from '../types';

const storageFallback: string[] = [];
const prepFallback: string[] = [];

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase 환경변수가 설정되지 않았어요. VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 확인해주세요.');
  }
  return supabase;
}

function isMissingRelationError(error: { code?: string; message?: string }) {
  return (
    error.code === 'PGRST205' ||
    error.code === 'PGRST202' ||
    error.message?.includes('Could not find the table') ||
    error.message?.includes('schema cache')
  );
}

function arrayFromDb(value: unknown, legacyValue: unknown, fallback: string[]) {
  if (Array.isArray(value)) return value;
  if (typeof legacyValue === 'string' && legacyValue) return [legacyValue];
  return fallback;
}

function normalizeItemRow<T extends { storage_tags?: unknown; storage_tag?: unknown; prep_tags?: unknown; prep_tag?: unknown }>(item: T) {
  return {
    ...item,
    storage_tags: arrayFromDb(item.storage_tags, item.storage_tag, storageFallback),
    prep_tags: arrayFromDb(item.prep_tags, item.prep_tag, prepFallback),
  };
}

export async function getSession() {
  const client = requireSupabase();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signIn(email: string, password: string) {
  const client = requireSupabase();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email: string, password: string, displayName: string) {
  const client = requireSupabase();
  console.info('[dobob auth] signUp:start', { email });
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
      },
    },
  });
  if (error) {
    console.error('[dobob auth] signUp:error', error);
    throw error;
  }

  const user = data.user ?? data.session?.user ?? null;
  console.info('[dobob auth] signUp:response', {
    hasUser: Boolean(data.user),
    hasSession: Boolean(data.session),
    userId: user?.id,
  });

  if (data.session) {
    console.info('[dobob auth] signUp:ensureProfile:start');
    const profile = await ensureProfile(displayName);
    console.info('[dobob auth] signUp:ensureProfile:done', {
      hasProfile: Boolean(profile),
      profileId: profile?.id,
    });
  } else {
    console.error('[dobob auth] signUp:noSession', {
      message: 'Confirm email should be OFF. Supabase did not return a session after signup.',
      hasUser: Boolean(user),
      userId: user?.id,
    });
  }

  return {
    user,
    session: data.session,
  };
}

export async function ensureProfile(displayName: string) {
  const client = requireSupabase();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) {
    console.error('[dobob auth] ensureProfile:getSession:error', sessionError);
    throw sessionError;
  }

  const userId = sessionData.session?.user.id;
  console.info('[dobob auth] ensureProfile:session', {
    hasSession: Boolean(sessionData.session),
    userId,
  });
  if (!userId) return null;

  const { data, error } = await client
    .from('profiles')
    .upsert(
      {
        id: userId,
        display_name: displayName,
      },
      { onConflict: 'id' },
    )
    .select()
    .maybeSingle();
  if (error) {
    console.error('[dobob auth] ensureProfile:upsert:error', error);
    throw error;
  }
  console.info('[dobob auth] ensureProfile:upsert:done', {
    hasProfile: Boolean(data),
    profileId: data?.id,
  });
  return data as Profile | null;
}

export async function signOut() {
  const client = requireSupabase();
  await client.auth.signOut();
}

export async function getCurrentProfile() {
  const client = requireSupabase();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;

  const userId = sessionData.session?.user.id;
  console.info('[dobob auth] getCurrentProfile:session', {
    hasSession: Boolean(sessionData.session),
    userId,
  });
  if (!userId) return null;

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('[dobob auth] getCurrentProfile:error', error);
    throw error;
  }
  console.info('[dobob auth] getCurrentProfile:result', {
    hasProfile: Boolean(data),
    profileId: data?.id,
  });
  if (!data) return null;
  const profile = data as Profile;
  if (!profile.display_name) {
    throw new Error('프로필 이름이 설정되지 않았어요.');
  }
  return profile;
}

export async function updateProfileDisplayName(displayName: string) {
  const client = requireSupabase();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;

  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error('로그인 정보를 확인할 수 없어요.');

  const { data, error } = await client
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data as Profile;
}

export async function fetchProfiles(householdId: string) {
  const client = requireSupabase();
  const { data: members, error: memberError } = await client
    .from('household_members')
    .select('user_id')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });

  if (memberError) throw memberError;
  const userIds = (members || []).map((member) => member.user_id);
  if (userIds.length === 0) return [];

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .in('id', userIds);
  if (error) throw error;

  return data as Profile[];
}

export async function fetchMyHouseholds() {
  const client = requireSupabase();
  const { data, error } = await client
    .from('household_members')
    .select('household_id, role, households!inner(*)')
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data || []).map((row) => {
    const household = Array.isArray(row.households) ? row.households[0] : row.households;
    return {
      ...(household as Household),
      role: row.role as 'owner' | 'member',
    };
  });
}

export async function createHousehold(name: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('create_household_with_owner', {
    household_name: name,
  });

  if (error) throw error;
  return data as Household;
}

export async function joinHousehold(inviteCode: string) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('join_household_by_code', {
    code: inviteCode,
  });

  if (error) throw error;
  return data as Household;
}

export async function fetchMeals(householdId: string, limit = 30) {
  const client = requireSupabase();
  const { data: mealRows, error } = await client
    .from('meal_missions')
    .select('*')
    .eq('household_id', householdId)
    .order('meal_date', { ascending: false })
    .order('slot', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[dobob meal] fetch missions failed', { error, householdId });
    throw error;
  }

  const missionIds = (mealRows || []).map((meal) => meal.id);
  if (missionIds.length === 0) return [];

  const { data: itemRows, error: itemError } = await client
    .from('meal_mission_items')
    .select('*')
    .in('mission_id', missionIds)
    .order('sort_order', { ascending: true });

  if (itemError) {
    console.error('[dobob meal] fetch items failed', { error: itemError, householdId, missionIds });
    if (isMissingRelationError(itemError)) {
      console.warn('[dobob meal] meal_mission_items table is missing. Returning missions with empty items until schema.sql is applied.');
      return (mealRows || []).map((meal) => ({
        ...meal,
        items: [],
      })) as MealMission[];
    }
    throw itemError;
  }

  return (mealRows || []).map((meal) => ({
    ...meal,
    items: (itemRows || []).filter((item) => item.mission_id === meal.id).map(normalizeItemRow),
  })) as MealMission[];
}

export async function upsertMeal(householdId: string, input: MealInput, authorId: string, existingId?: string) {
  const client = requireSupabase();
  const { items, ...missionInput } = input;
  const payload = existingId
    ? { ...missionInput, id: existingId, household_id: householdId, author_id: authorId }
    : { ...missionInput, household_id: householdId, author_id: authorId };

  console.info('[dobob meal] upsert:start', {
    householdId,
    authorId,
    existingId,
    payload,
    itemCount: items.length,
  });
  console.log('[dobob meal] payload', payload);
  let data: unknown;
  let error: unknown;
  let queryMode = '';

  if (existingId) {
    queryMode = 'update by id';
    console.log('[dobob meal] query', {
      table: 'meal_missions',
      operation: 'update',
      match: { id: existingId },
      payload,
    });
    const result = await client
      .from('meal_missions')
      .update(payload)
      .eq('id', existingId)
      .select()
      .single();
    data = result.data;
    error = result.error;
  } else {
    queryMode = 'insert meal';
    console.log('[dobob meal] query', {
      table: 'meal_missions',
      operation: 'insert',
      payload,
    });
    const result = await client
      .from('meal_missions')
      .insert(payload)
      .select()
      .single();
    data = result.data;
    error = result.error;
  }

  if (error) {
    console.log('[dobob meal] raw error', error);
    console.error('[dobob meal] upsert:mission failed', {
      error,
      queryMode,
      payload,
      slot: payload.slot,
      meal_type: (payload as Record<string, unknown>).meal_type,
      category: (payload as Record<string, unknown>).category,
      mission_type: (payload as Record<string, unknown>).mission_type,
    });
    throw error;
  }

  const mission = data as MealMission;
  const normalizedItems = items
    .map((item, index) => ({
      mission_id: mission.id,
      name: item.name.trim(),
      storage_tags: item.storage_tags,
      sort_order: index,
    }))
    .filter((item) => item.name || item.storage_tags.length > 0);

  const { error: deleteItemsError } = await client
    .from('meal_mission_items')
    .delete()
    .eq('mission_id', mission.id);
  if (deleteItemsError) {
    console.warn('[dobob meal] upsert:delete items warning', {
      error: deleteItemsError,
      missionId: mission.id,
    });
  }

  let savedItems = normalizedItems.map((item) => ({
    id: crypto.randomUUID(),
    mission_id: mission.id,
    name: item.name,
    location: '',
    storage_tags: item.storage_tags,
    prep: '',
    prep_tags: [],
    amount: '',
    sort_order: item.sort_order,
  }));

  if (!deleteItemsError && normalizedItems.length > 0) {
    const { error: insertItemsError } = await client
      .from('meal_mission_items')
      .insert(normalizedItems);
    if (insertItemsError) {
      console.warn('[dobob meal] upsert:insert items warning', {
        error: insertItemsError,
        missionId: mission.id,
        items: normalizedItems,
      });
    }
  }

  console.info('[dobob meal] upsert:done', {
    missionId: mission.id,
    itemCount: savedItems.length,
  });
  return { ...mission, items: savedItems } as MealMission;
}

export async function deleteMeal(mealId: string) {
  const client = requireSupabase();
  const { error } = await client.from('meal_missions').delete().eq('id', mealId);
  if (error) throw error;
}

export async function toggleFed(meal: MealMission) {
  const client = requireSupabase();
  const isFed = !meal.is_fed;
  const fedAt = isFed ? new Date().toISOString() : null;

  const { error } = await client
    .from('meal_missions')
    .update({ is_fed: isFed, fed_at: fedAt })
    .eq('id', meal.id);
  if (error) throw error;
}

export async function fetchMemos(householdId: string, offset = 0, limit = 6) {
  const client = requireSupabase();
  const { data, error, count } = await client
    .from('fridge_memos')
    .select('*', { count: 'exact' })
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return {
    memos: data as FridgeMemo[],
    hasMore: typeof count === 'number' ? offset + limit < count : (data || []).length === limit,
  };
}

export async function fetchMemoReminders(householdId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('memo_reminders')
    .select('*')
    .eq('household_id', householdId)
    .eq('status', 'pending')
    .order('remind_at', { ascending: true });

  if (error) throw error;
  return (data || []) as MemoReminder[];
}

export async function upsertMemo(householdId: string, input: FridgeMemoInput, authorId: string, existingId?: string) {
  const client = requireSupabase();
  const memoId = existingId || crypto.randomUUID();
  const payload: {
    id: string;
    household_id: string;
    text: string;
    author_id: string;
  } = {
    id: memoId,
    household_id: householdId,
    text: input.text,
    author_id: authorId,
  };

  const { error } = await client
    .from('fridge_memos')
    .upsert(payload);
  if (error) throw error;

  return {
    ...payload,
    created_at: new Date().toISOString(),
  } as FridgeMemo;
}

export async function scheduleMemoReminder(input: {
  memoId: string;
  householdId: string;
  senderId: string;
  remindAt: string;
}) {
  const client = requireSupabase();
  const { error } = await client
    .from('memo_reminders')
    .insert({
      memo_id: input.memoId,
      household_id: input.householdId,
      sender_id: input.senderId,
      remind_at: input.remindAt,
      status: 'pending',
    });

  if (error) throw error;
}

export async function deleteMemo(memoId: string) {
  const client = requireSupabase();
  const { error } = await client.from('fridge_memos').delete().eq('id', memoId);
  if (error) throw error;
}

export async function deleteMemos(memoIds: string[]) {
  if (memoIds.length === 0) return;
  const client = requireSupabase();
  const { error } = await client.from('fridge_memos').delete().in('id', memoIds);
  if (error) throw error;
}

export async function fetchTemplates(householdId: string) {
  const client = requireSupabase();
  const { data: templateRows, error } = await client
    .from('menu_templates')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[dobob template] fetch failed', { error, householdId });
    throw error;
  }

  return (templateRows || []).map((template) => ({
    ...template,
    items: [],
  })) as MenuTemplate[];
}

export async function saveTemplate(householdId: string, input: FavoriteInput, authorId: string, existingId?: string) {
  const client = requireSupabase();
  const templateInput = {
    menu_name: input.menu_name.trim(),
    note: input.note.trim(),
    storage_tags: input.items[0]?.storage_tags || [],
  };
  console.info('[dobob template] save:start', {
    householdId,
    authorId,
    existingId,
    menuName: templateInput.menu_name,
  });
  const templatePayload = { ...templateInput, household_id: householdId, author_id: authorId };
  let result = existingId
    ? await client
      .from('menu_templates')
      .update(templatePayload)
      .eq('id', existingId)
      .select()
      .single()
    : await client
      .from('menu_templates')
      .insert(templatePayload)
      .select()
      .single();
  if (result.error && String(result.error.message || '').includes('storage_tags')) {
    const { storage_tags: _storageTags, ...fallbackPayload } = templatePayload;
    console.warn('[dobob template] storage_tags column missing, retrying without it', {
      error: result.error,
      menuName: templateInput.menu_name,
    });
    result = existingId
      ? await client
        .from('menu_templates')
        .update(fallbackPayload)
        .eq('id', existingId)
        .select()
        .single()
      : await client
        .from('menu_templates')
        .insert(fallbackPayload)
        .select()
        .single();
  }
  const { data, error } = result;
  if (error) {
    console.error('[dobob template] save:template failed', { error, templateInput });
    throw error;
  }

  const template = data as MenuTemplate;
  console.info('[dobob template] save:done', {
    templateId: template.id,
  });
  return { ...template, storage_tags: templateInput.storage_tags, items: [] } as MenuTemplate;
}

export async function deleteTemplate(templateId: string) {
  const client = requireSupabase();
  const { error } = await client.from('menu_templates').delete().eq('id', templateId);
  if (error) throw error;
}

export async function deleteTemplates(templateIds: string[]) {
  if (templateIds.length === 0) return;
  const client = requireSupabase();
  const { error } = await client.from('menu_templates').delete().in('id', templateIds);
  if (error) throw error;
}

export const slotLabel: Record<MealSlot, string> = {
  breakfast: '아침',
  snack: '간식',
  dinner: '저녁',
};
