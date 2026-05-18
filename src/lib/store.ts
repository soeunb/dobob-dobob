import { supabase } from './supabase';
import { FridgeMemo, FridgeMemoInput, MealInput, MealMission, MealSlot, MenuTemplate, Profile, TemplateInput } from '../types';

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

export async function signOut() {
  const client = requireSupabase();
  await client.auth.signOut();
}

export async function getCurrentProfile() {
  const client = requireSupabase();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;

  const userId = sessionData.session?.user.id;
  if (!userId) return null;

  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function fetchProfiles(householdId: string) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data as Profile[];
}

export async function fetchMeals(householdId: string, limit = 30) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('meal_missions')
    .select('*')
    .eq('household_id', householdId)
    .order('meal_date', { ascending: false })
    .order('slot', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data as MealMission[];
}

export async function upsertMeal(householdId: string, input: MealInput, authorId: string, existingId?: string) {
  const client = requireSupabase();
  const payload = existingId
    ? { ...input, id: existingId, household_id: householdId, author_id: authorId }
    : { ...input, household_id: householdId, author_id: authorId };

  const { data, error } = await client
    .from('meal_missions')
    .upsert(payload, { onConflict: 'household_id,meal_date,slot' })
    .select()
    .single();
  if (error) throw error;
  return data as MealMission;
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
  const payload = existingId
    ? { id: existingId, household_id: householdId, text: input.text, author_id: authorId }
    : { household_id: householdId, text: input.text, author_id: authorId };

  const { data, error } = await client
    .from('fridge_memos')
    .upsert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as FridgeMemo;
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

export async function saveTemplate(householdId: string, input: TemplateInput) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('menu_templates')
    .insert({ ...input, household_id: householdId })
    .select()
    .single();
  if (error) throw error;
  return data as MenuTemplate;
}

export const slotLabel: Record<MealSlot, string> = {
  breakfast: '아침',
  dinner: '저녁',
};
