import { supabase } from './supabase';
import { FridgeMemo, FridgeMemoInput, Household, MealInput, MealMission, MealSlot, MenuTemplate, Profile, TemplateInput } from '../types';

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase 환경변수가 설정되지 않았어요. VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 확인해주세요.');
  }
  return supabase;
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
  const { data, error } = await client
    .from('meal_missions')
    .select('*, items:meal_mission_items(*)')
    .eq('household_id', householdId)
    .order('meal_date', { ascending: false })
    .order('slot', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return (data || []).map((meal) => ({
    ...meal,
    items: [...(meal.items || [])].sort((a, b) => a.sort_order - b.sort_order),
  })) as MealMission[];
}

export async function upsertMeal(householdId: string, input: MealInput, authorId: string, existingId?: string) {
  const client = requireSupabase();
  const { items, ...missionInput } = input;
  const payload = existingId
    ? { ...missionInput, id: existingId, household_id: householdId, author_id: authorId }
    : { ...missionInput, household_id: householdId, author_id: authorId };

  const { data, error } = await client
    .from('meal_missions')
    .upsert(payload, { onConflict: 'household_id,meal_date,slot' })
    .select()
    .single();
  if (error) throw error;

  const mission = data as MealMission;
  const normalizedItems = items
    .map((item, index) => ({
      mission_id: mission.id,
      name: item.name.trim(),
      location: item.location.trim(),
      storage_tag: item.storage_tag,
      prep: item.prep.trim(),
      prep_tag: item.prep_tag,
      amount: item.amount.trim(),
      sort_order: index,
    }))
    .filter((item) => item.name || item.location || item.prep || item.amount);

  const { error: deleteItemsError } = await client
    .from('meal_mission_items')
    .delete()
    .eq('mission_id', mission.id);
  if (deleteItemsError) throw deleteItemsError;

  if (normalizedItems.length > 0) {
    const { error: insertItemsError } = await client
      .from('meal_mission_items')
      .insert(normalizedItems);
    if (insertItemsError) throw insertItemsError;
  }

  return { ...mission, items: normalizedItems } as MealMission;
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

export async function fetchMemos(householdId: string, limit = 30) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('fridge_memos')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as FridgeMemo[];
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

export async function deleteMemo(memoId: string) {
  const client = requireSupabase();
  const { error } = await client.from('fridge_memos').delete().eq('id', memoId);
  if (error) throw error;
}

export async function fetchTemplates(householdId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('menu_templates')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as MenuTemplate[];
}

export async function saveTemplate(householdId: string, input: TemplateInput, authorId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('menu_templates')
    .insert({ menu_name: input.menu_name, note: input.note, household_id: householdId, author_id: authorId })
    .select()
    .single();
  if (error) throw error;
  return data as MenuTemplate;
}

export const slotLabel: Record<MealSlot, string> = {
  breakfast: '아침',
  dinner: '저녁',
};
