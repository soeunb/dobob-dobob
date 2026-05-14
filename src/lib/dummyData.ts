import { MealMission, MenuTemplate } from '../types';
import { todayKey } from './date';

export const DEMO_HOUSEHOLD_ID = import.meta.env.VITE_DEMO_HOUSEHOLD_ID || '00000000-0000-0000-0000-000000000001';

const today = todayKey();

export const dummyMeals: MealMission[] = [
  {
    id: 'demo-breakfast',
    household_id: DEMO_HOUSEHOLD_ID,
    meal_date: today,
    slot: 'breakfast',
    menu_name: '밥 + 소고기무국 + 돈까스',
    location: '냉동고 밥 1팩, 냉장고 왼쪽 국통, 김은 작은 통',
    prep: '돈까스 2개 에프 180도 8분. 국은 전자레인지 1분 30초',
    amount: '밥 1팩, 돈까스 2개',
    note: '뜨거우면 작은 접시에 펼쳐서 식혀주기',
    storage_tag: 'freezer',
    prep_tag: 'airfryer',
    is_fed: false,
    fed_at: null,
  },
  {
    id: 'demo-dinner',
    household_id: DEMO_HOUSEHOLD_ID,
    meal_date: today,
    slot: 'dinner',
    menu_name: '카레 + 딸기',
    location: '카레는 냉장고 오른쪽 투명 통, 딸기는 과일칸',
    prep: '카레 데우기. 딸기 3개 꼭지 제거해서 반으로 잘라주기',
    amount: '카레 반 공기, 딸기 3개',
    note: '카레가 되직하면 물 한 숟갈 넣기',
    storage_tag: 'fridge',
    prep_tag: 'microwave',
    is_fed: false,
    fed_at: null,
  },
  {
    id: 'demo-yesterday-breakfast',
    household_id: DEMO_HOUSEHOLD_ID,
    meal_date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
    slot: 'breakfast',
    menu_name: '계란찜 + 밥',
    location: '계란찜은 냉장고 중간 칸 노란 뚜껑',
    prep: '전자레인지 50초 후 섞어서 20초 더',
    amount: '밥 반 팩',
    note: '김가루 조금만',
    storage_tag: 'fridge',
    prep_tag: 'microwave',
    is_fed: true,
    fed_at: new Date(Date.now() - 82000000).toISOString(),
  },
];

export const dummyTemplates: MenuTemplate[] = [
  {
    id: 'tpl-curry',
    household_id: DEMO_HOUSEHOLD_ID,
    menu_name: '카레',
    location: '냉장고 오른쪽 투명 통',
    prep: '전자레인지 1분, 섞고 30초 더',
    amount: '반 공기',
    note: '뜨거우면 물 한 숟갈',
    storage_tag: 'fridge',
    prep_tag: 'microwave',
  },
  {
    id: 'tpl-cutlet',
    household_id: DEMO_HOUSEHOLD_ID,
    menu_name: '돈까스',
    location: '냉동고 아래 칸 지퍼백',
    prep: '에프 180도 8분',
    amount: '2개',
    note: '케첩은 아주 조금',
    storage_tag: 'freezer',
    prep_tag: 'airfryer',
  },
];
