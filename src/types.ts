export type MealSlot = 'breakfast' | 'dinner';
export type StorageTag = 'freezer' | 'fridge' | 'room';
export type PrepTag = 'microwave' | 'airfryer' | 'serve';

export type MealMission = {
  id: string;
  household_id: string;
  meal_date: string;
  slot: MealSlot;
  menu_name: string;
  location: string;
  prep: string;
  amount: string;
  note: string;
  storage_tag: StorageTag;
  prep_tag: PrepTag;
  is_fed: boolean;
  fed_at: string | null;
  author_id: string | null;
  created_at?: string;
  updated_at?: string;
};

export type MenuTemplate = {
  id: string;
  household_id: string;
  menu_name: string;
  location: string;
  prep: string;
  amount: string;
  note: string;
  storage_tag: StorageTag;
  prep_tag: PrepTag;
  created_at?: string;
};

export type FridgeMemo = {
  id: string;
  household_id: string;
  text: string;
  author_id: string | null;
  created_at: string;
  updated_at?: string;
};

export type Profile = {
  id: string;
  display_name: string;
  household_id: string;
  created_at?: string;
};

export type MealInput = Omit<MealMission, 'id' | 'household_id' | 'is_fed' | 'fed_at' | 'author_id' | 'created_at' | 'updated_at'>;
export type TemplateInput = Omit<MenuTemplate, 'id' | 'household_id' | 'created_at'>;
export type FridgeMemoInput = Pick<FridgeMemo, 'text'>;
