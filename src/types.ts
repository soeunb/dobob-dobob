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
  author_name: string;
  author_emoji: string;
  body: string;
  created_at: string;
};

export type MealInput = Omit<MealMission, 'id' | 'household_id' | 'is_fed' | 'fed_at' | 'created_at' | 'updated_at'>;
export type TemplateInput = Omit<MenuTemplate, 'id' | 'household_id' | 'created_at'>;
export type FridgeMemoInput = Pick<FridgeMemo, 'author_name' | 'author_emoji' | 'body'>;
