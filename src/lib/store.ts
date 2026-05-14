import { dummyMeals, dummyTemplates, DEMO_HOUSEHOLD_ID } from './dummyData';
import { isSupabaseConfigured, supabase } from './supabase';
import { MealInput, MealMission, MealSlot, MenuTemplate, TemplateInput } from '../types';

const MEALS_KEY = 'dobob-meals';
const TEMPLATES_KEY = 'dobob-templates';

function readLocal<T>(key: string, fallback: T): T {
  const saved = localStorage.getItem(key);
  return saved ? JSON.parse(saved) : fallback;
}

function writeLocal<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signIn(email: string, password: string) {
  if (!supabase) return { demo: true };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { demo: false };
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}

export async function fetchMeals(householdId: string, limit = 30) {
  if (!supabase) {
    return readLocal<MealMission[]>(MEALS_KEY, dummyMeals).slice(0, limit);
  }

  const { data, error } = await supabase
    .from('meal_missions')
    .select('*')
    .eq('household_id', householdId)
    .order('meal_date', { ascending: false })
    .order('slot', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return data as MealMission[];
}

export async function upsertMeal(householdId: string, input: MealInput, existingId?: string) {
  if (!supabase) {
    const meals = readLocal<MealMission[]>(MEALS_KEY, dummyMeals);
    const sameSlotMeal = meals.find(
      (meal) => meal.household_id === householdId && meal.meal_date === input.meal_date && meal.slot === input.slot,
    );
    const id = existingId || sameSlotMeal?.id || crypto.randomUUID();
    const previous = meals.find((meal) => meal.id === id);
    const nextMeal: MealMission = {
      ...input,
      id,
      household_id: householdId,
      is_fed: previous?.is_fed ?? false,
      fed_at: previous?.fed_at ?? null,
    };
    const next = [nextMeal, ...meals.filter((meal) => meal.id !== id)];
    writeLocal(MEALS_KEY, next);
    return nextMeal;
  }

  const payload = existingId
    ? { ...input, id: existingId, household_id: householdId }
    : { ...input, household_id: householdId };
  const { data, error } = await supabase
    .from('meal_missions')
    .upsert(payload, { onConflict: 'household_id,meal_date,slot' })
    .select()
    .single();
  if (error) throw error;
  return data as MealMission;
}

export async function toggleFed(meal: MealMission) {
  const isFed = !meal.is_fed;
  const fedAt = isFed ? new Date().toISOString() : null;

  if (!supabase) {
    const meals = readLocal<MealMission[]>(MEALS_KEY, dummyMeals).map((item) =>
      item.id === meal.id ? { ...item, is_fed: isFed, fed_at: fedAt } : item,
    );
    writeLocal(MEALS_KEY, meals);
    return;
  }

  const { error } = await supabase
    .from('meal_missions')
    .update({ is_fed: isFed, fed_at: fedAt })
    .eq('id', meal.id);
  if (error) throw error;
}

export async function fetchTemplates(householdId: string) {
  if (!supabase) return readLocal<MenuTemplate[]>(TEMPLATES_KEY, dummyTemplates);

  const { data, error } = await supabase
    .from('menu_templates')
    .select('*')
    .eq('household_id', householdId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data as MenuTemplate[];
}

export async function saveTemplate(householdId: string, input: TemplateInput) {
  if (!supabase) {
    const templates = readLocal<MenuTemplate[]>(TEMPLATES_KEY, dummyTemplates);
    const nextTemplate = { ...input, id: crypto.randomUUID(), household_id: householdId };
    writeLocal(TEMPLATES_KEY, [nextTemplate, ...templates]);
    return nextTemplate;
  }

  const { data, error } = await supabase
    .from('menu_templates')
    .insert({ ...input, household_id: householdId })
    .select()
    .single();
  if (error) throw error;
  return data as MenuTemplate;
}

export function getHouseholdId() {
  return import.meta.env.VITE_DEMO_HOUSEHOLD_ID || DEMO_HOUSEHOLD_ID;
}

export const slotLabel: Record<MealSlot, string> = {
  breakfast: '아침',
  dinner: '저녁',
};
