export type MealSlot = 'breakfast' | 'dinner';
export type StorageTag = 'freezer' | 'fridge' | 'room';
export type PrepTag = 'microwave' | 'airfryer' | 'serve';

export type MealMission = {
  id: string;
  household_id: string;
  meal_date: string;
  slot: MealSlot;
  menu_name: string;
  note: string;
  is_fed: boolean;
  fed_at: string | null;
  author_id: string | null;
  items: MealMissionItem[];
  created_at?: string;
  updated_at?: string;
};

export type MealMissionItem = {
  id: string;
  mission_id: string;
  name: string;
  location: string;
  storage_tags: StorageTag[];
  prep: string;
  prep_tags: PrepTag[];
  amount: string;
  sort_order: number;
  created_at?: string;
};

export type MenuTemplate = {
  id: string;
  household_id: string;
  author_id: string | null;
  menu_name: string;
  note: string;
  items: MenuTemplateItem[];
  created_at?: string;
};

export type MenuTemplateItem = {
  id: string;
  template_id: string;
  name: string;
  location: string;
  storage_tags: StorageTag[];
  prep: string;
  prep_tags: PrepTag[];
  amount: string;
  sort_order: number;
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
  created_at?: string;
};

export type Household = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string | null;
  created_at?: string;
};

export type HouseholdMember = {
  id: string;
  household_id: string;
  user_id: string;
  role: 'owner' | 'member';
  created_at?: string;
};

export type MealMissionItemInput = Omit<MealMissionItem, 'id' | 'mission_id' | 'sort_order' | 'created_at'>;
export type MealInput = Pick<MealMission, 'meal_date' | 'slot' | 'menu_name' | 'note'> & {
  items: MealMissionItemInput[];
};
export type TemplateInput = Omit<MenuTemplate, 'id' | 'household_id' | 'author_id' | 'items' | 'created_at'> & {
  items: MealMissionItemInput[];
};
export type FridgeMemoInput = Pick<FridgeMemo, 'text'>;
