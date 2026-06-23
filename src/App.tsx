import { useEffect, useMemo, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, CSSProperties, FormEvent, MouseEvent, ReactNode } from 'react';
import {
  Baby,
  Bell,
  ChefHat,
  Edit3,
  Flame,
  History,
  Home,
  LogOut,
  Menu,
  Microwave,
  Milk,
  Plus,
  Refrigerator,
  Save,
  Snowflake,
  Star,
  Settings,
  Trash2,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatKoreanDate, todayKey } from './lib/date';
import {
  createHousehold,
  deleteMeal,
  deleteMemo,
  deleteMemos,
  deleteTemplate,
  deleteTemplates,
  fetchMeals,
  fetchMemos,
  fetchMyHouseholds,
  fetchMemoReminders,
  fetchProfiles,
  fetchTemplates,
  getCurrentProfile,
  getSession,
  joinHousehold,
  ensureProfile,
  saveTemplate,
  scheduleMemoReminder,
  signIn,
  signOut,
  signUp,
  slotLabel,
  upsertMeal,
  upsertMemo,
  updateProfileDisplayName,
} from './lib/store';
import { getPushStatus, notifyHouseholdPush, registerPushSubscription } from './lib/push';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import {
  FridgeMemo,
  Household,
  MealInput,
  MealMission,
  MealMissionItemInput,
  MealSlot,
  MemoReminder,
  MenuTemplate,
  PrepTag,
  Profile,
  StorageTag,
} from './types';

const defaultItem: MealMissionItemInput = {
  name: '',
  location: '',
  storage_tags: [],
  prep: '',
  prep_tags: [],
  amount: '',
};

const defaultInput: MealInput = {
  meal_date: todayKey(),
  slot: 'breakfast',
  menu_name: '',
  note: '',
  items: [{ ...defaultItem }],
};

const MEMO_PAGE_SIZE = 6;
function mealToInput(meal: MealMission, overrides: Partial<Pick<MealInput, 'meal_date' | 'slot'>> = {}): MealInput {
  return {
    meal_date: overrides.meal_date || meal.meal_date,
    slot: overrides.slot || meal.slot,
    menu_name: meal.menu_name,
    note: meal.note,
    items: meal.items.length > 0
      ? meal.items.map((item) => ({
          name: item.name,
          location: item.location,
          storage_tags: item.storage_tags,
          prep: item.prep,
          prep_tags: item.prep_tags,
          amount: item.amount,
        }))
      : [{ ...defaultItem }],
  };
}

function templateToInput(
  template: MenuTemplate,
  overrides: Partial<Pick<MealInput, 'meal_date' | 'slot'>> = {},
): MealInput {
  return {
    meal_date: overrides.meal_date || todayKey(),
    slot: overrides.slot || 'breakfast',
    menu_name: template.menu_name,
    note: template.note,
    items: template.items.length > 0
      ? template.items.map((item) => ({
          name: item.name,
          location: item.location,
          storage_tags: item.storage_tags,
          prep: item.prep,
          prep_tags: item.prep_tags,
          amount: item.amount,
        }))
      : [{ ...defaultItem, name: template.menu_name, storage_tags: template.storage_tags || [] }],
  };
}

function compactMealInput(input: MealInput, menuName: string): MealInput {
  const storage_tags = input.items[0]?.storage_tags || [];
  return {
    meal_date: input.meal_date || todayKey(),
    slot: input.slot,
    menu_name: menuName,
    note: input.note,
    items: [{
      ...defaultItem,
      name: menuName,
      storage_tags,
    }],
  };
}

function storageLabels(values: StorageTag[]) {
  return Array.from(new Set(values))
    .map((value) => storageOptions.find((option) => option.value === value)?.label)
    .filter(Boolean)
    .join(' · ');
}

const DOB0B_ICON_BASE = '/icons/dobob/svg_wrapped';

function iconPathFromMenuName(name: string, fallback = 'meals/meal-sidedish.svg') {
  const normalized = name.trim().toLowerCase();
  const iconMap: Array<[string[], string]> = [
    [['수박', 'watermelon'], 'fruits/fruit-watermelon.svg'],
    [['바나나', 'banana'], 'fruits/fruit-banana.svg'],
    [['딸기', 'strawberry'], 'fruits/fruit-strawberry.svg'],
    [['사과', 'apple'], 'fruits/fruit-apple.svg'],
    [['포도', 'grape'], 'fruits/fruit-grape.svg'],
    [['귤', '감귤', '오렌지', 'orange', 'tangerine'], 'fruits/fruit-tangerine.svg'],
    [['배', 'pear'], 'fruits/fruit-pear.svg'],
    [['체리', 'cherry'], 'fruits/fruit-cherry.svg'],
    [['블루베리', 'blueberry'], 'fruits/fruit-blueberry.svg'],
    [['키위', 'kiwi'], 'fruits/fruit-kiwi.svg'],
    [['망고', 'mango'], 'fruits/fruit-mango.svg'],
    [['복숭아', 'peach'], 'fruits/fruit-peach.svg'],
    [['우유', 'milk'], 'ai/snack-milk.svg'],
    [['요거트', '요구르트', 'yogurt', 'yoghurt'], 'ai/snack-yogurt.svg'],
    [['젤리', 'jelly', 'gummy'], 'ai/snack-jelly.svg'],
    [['쿠키', 'cookie'], 'ai/snack-cookie.svg'],
    [['김밥', '주먹밥', 'riceball'], 'meals/meal-riceball.svg'],
    [['카레', 'curry'], 'meals/meal-curry.svg'],
    [['국', '탕', '스프', 'soup'], 'meals/meal-soup.svg'],
    [['면', '국수', '라면', 'noodle'], 'meals/meal-noodle.svg'],
    [['만두', 'dumpling'], 'meals/meal-dumpling.svg'],
    [['계란', '달걀', 'egg'], 'meals/meal-egg.svg'],
    [['돈까스', '고기', '소고기', '치킨', '너겟', 'meat'], 'meals/meal-meat.svg'],
    [['생선', 'fish'], 'meals/meal-fish.svg'],
    [['빵', '과자', '크루아상', 'bread', 'snack', 'croissant'], 'meals/meal-bread.svg'],
    [['파스타', 'pasta'], 'meals/meal-pasta.svg'],
    [['밥', '죽', 'rice'], 'meals/meal-rice.svg'],
    [['반찬', '나물', '치즈', 'cheese'], 'meals/meal-sidedish.svg'],
  ];
  const match = iconMap.find(([keywords]) => keywords.some((keyword) => normalized.includes(keyword)));
  return `${DOB0B_ICON_BASE}/${match?.[1] || fallback}`;
}

const storageOptions: Array<{ value: StorageTag; label: string; icon: LucideIcon }> = [
  { value: 'freezer', label: '냉동', icon: Snowflake },
  { value: 'fridge', label: '냉장', icon: Refrigerator },
  { value: 'room', label: '실온', icon: Home },
];

const prepOptions: Array<{ value: PrepTag; label: string; icon: LucideIcon }> = [
  { value: 'microwave', label: '전자레인지', icon: Microwave },
  { value: 'airfryer', label: '에프', icon: Flame },
  { value: 'serve', label: '그냥 주기', icon: Baby },
];

function inviteCodeFromPath() {
  const match = window.location.pathname.match(/^\/join\/([A-Za-z0-9_-]+)/);
  return match?.[1]?.toUpperCase() || '';
}

function inviteLink(code: string) {
  return `${window.location.origin}/join/${code}`;
}

function App() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [meals, setMeals] = useState<MealMission[]>([]);
  const [templates, setTemplates] = useState<MenuTemplate[]>([]);
  const [memos, setMemos] = useState<FridgeMemo[]>([]);
  const [memoReminders, setMemoReminders] = useState<MemoReminder[]>([]);
  const [hasMoreMemos, setHasMoreMemos] = useState(false);
  const [isMemoLoading, setIsMemoLoading] = useState(false);
  const [isMemoSelectMode, setIsMemoSelectMode] = useState(false);
  const [selectedMemoIds, setSelectedMemoIds] = useState<string[]>([]);
  const [isTemplateSelectMode, setIsTemplateSelectMode] = useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [currentHousehold, setCurrentHousehold] = useState<Household | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'write' | 'history' | 'templates' | 'family' | 'settings'>('home');
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [editing, setEditing] = useState<MealMission | null>(null);
  const [input, setInput] = useState<MealInput>(defaultInput);
  const [memoBody, setMemoBody] = useState('');
  const [pushStatus, setPushStatus] = useState(() => getPushStatus());
  const [householdName, setHouseholdName] = useState('');
  const [settingsDisplayName, setSettingsDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [pendingInviteCode, setPendingInviteCode] = useState(() => inviteCodeFromPath());
  const [isJoiningInvite, setIsJoiningInvite] = useState(false);
  const [message, setMessage] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [bottomNavProgress, setBottomNavProgress] = useState(0);
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const lastScrollYRef = useRef(0);
  const bottomNavProgressRef = useRef(0);
  const householdId = currentHousehold?.id || '';

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => {
      setMessage('');
    }, 2800);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    setSettingsDisplayName(currentProfile?.display_name || '');
  }, [currentProfile?.display_name]);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    function handleScroll() {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollYRef.current;
      lastScrollYRef.current = currentY;
      if (Math.abs(delta) < 1) return;

      const nextProgress = currentY <= 24
        ? 0
        : Math.min(1, Math.max(0, bottomNavProgressRef.current + delta / 80));

      if (Math.abs(nextProgress - bottomNavProgressRef.current) < 0.01) return;
      bottomNavProgressRef.current = nextProgress;
      setBottomNavProgress(nextProgress);
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const bottomNavStyle = useMemo(() => {
    const progress = bottomNavProgress;
    return {
      '--nav-height': `${58 - 8 * progress}px`,
      '--nav-padding-y': `${5 - progress}px`,
      '--nav-padding-x': `${10 - 2 * progress}px`,
      '--nav-max-width': `${620 - 180 * progress}px`,
      '--nav-button-height': `${46 - 6 * progress}px`,
      '--nav-icon-size': `${23 - 2 * progress}px`,
    } as CSSProperties;
  }, [bottomNavProgress]);

  async function refresh(memoLimitOverride?: number) {
    if (!householdId) return;
    const memoLimit = Math.max(memoLimitOverride ?? memos.length, MEMO_PAGE_SIZE);
    const [mealResult, templateResult, memoResult, profileResult, reminderResult] = await Promise.allSettled([
      fetchMeals(householdId),
      fetchTemplates(householdId),
      fetchMemos(householdId, 0, memoLimit),
      fetchProfiles(householdId),
      fetchMemoReminders(householdId),
    ]);

    if (mealResult.status === 'fulfilled') {
      setMeals(mealResult.value);
    } else {
      console.error('[dobob refresh] meals failed', mealResult.reason);
    }

    if (templateResult.status === 'fulfilled') {
      setTemplates(templateResult.value);
    } else {
      console.error('[dobob refresh] templates failed', templateResult.reason);
    }

    if (memoResult.status === 'fulfilled') {
      setMemos(memoResult.value.memos);
      setHasMoreMemos(memoResult.value.hasMore);
    } else {
      console.error('[dobob refresh] memos failed', memoResult.reason);
    }

    if (profileResult.status === 'fulfilled') {
      setProfiles(profileResult.value);
    } else {
      console.error('[dobob refresh] profiles failed', profileResult.reason);
    }

    if (reminderResult.status === 'fulfilled') {
      setMemoReminders(reminderResult.value);
    } else {
      console.error('[dobob refresh] memo reminders failed', reminderResult.reason);
    }
  }

  useEffect(() => {
    let isMounted = true;

    function clearSessionState() {
      setCurrentProfile(null);
      setCurrentHousehold(null);
      setIsAuthed(false);
      setMeals([]);
      setMemos([]);
      setMemoReminders([]);
      setHasMoreMemos(false);
      setIsMemoSelectMode(false);
      setSelectedMemoIds([]);
      setTemplates([]);
      setProfiles([]);
    }

    async function restoreProfileAndHousehold() {
      const profile = await getCurrentProfile();
      if (!isMounted) return;

      if (!profile?.display_name) {
        clearSessionState();
        setMessage('프로필 정보가 없어요. 다시 로그인해주세요.');
        return;
      }

      const households = await fetchMyHouseholds();
      if (!isMounted) return;

      setCurrentProfile(profile);
      setCurrentHousehold(households[0] || null);
      setIsAuthed(true);
    }

    async function restoreSession() {
      try {
        const session = await getSession();
        if (!isMounted) return;

        if (session) {
          await restoreProfileAndHousehold();
        } else {
          clearSessionState();
        }
      } catch (error) {
        console.error(error);
        if (!isMounted) return;
        setMessage(error instanceof Error ? error.message : 'Supabase 연결을 확인해주세요.');
        clearSessionState();
      } finally {
        if (isMounted) setIsAuthLoading(false);
      }
    }

    restoreSession();

    const authSubscription = isSupabaseConfigured
      ? supabase!.auth.onAuthStateChange((_event, session) => {
          if (!isMounted) return;

          if (!session) {
            clearSessionState();
            setIsAuthLoading(false);
            return;
          }

          setTimeout(async () => {
            try {
              await restoreProfileAndHousehold();
            } catch (error) {
              console.error(error);
              if (!isMounted) return;
              setMessage(error instanceof Error ? error.message : '프로필 정보를 불러오지 못했어요.');
              clearSessionState();
            } finally {
              if (isMounted) setIsAuthLoading(false);
            }
          }, 0);
        }).data.subscription
      : null;

    return () => {
      isMounted = false;
      authSubscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isAuthed || !currentProfile || !currentHousehold) return;
    setMemos([]);
    setMemoReminders([]);
    setHasMoreMemos(false);
    refresh(MEMO_PAGE_SIZE);
  }, [isAuthed, currentProfile?.id, currentHousehold?.id]);

  useEffect(() => {
    if (!isAuthed || !currentProfile || !pendingInviteCode || isJoiningInvite) return;

    if (currentHousehold) {
      if (currentHousehold.invite_code === pendingInviteCode) {
        setPendingInviteCode('');
        window.history.replaceState({}, '', '/');
        return;
      }

      setMessage('이미 다른 가족방에 참여 중이에요. 지금은 한 계정당 하나의 가족방만 사용할 수 있어요.');
      return;
    }

    async function joinFromInviteLink() {
      try {
        setIsJoiningInvite(true);
        const household = await joinHousehold(pendingInviteCode);
        setCurrentHousehold(household);
        setPendingInviteCode('');
        setMessage('');
        window.history.replaceState({}, '', '/');
      } catch (error) {
        console.error(error);
        setMessage(error instanceof Error ? error.message : '초대 링크를 확인해주세요.');
      } finally {
        setIsJoiningInvite(false);
      }
    }

    joinFromInviteLink();
  }, [isAuthed, currentProfile?.id, currentHousehold?.id, pendingInviteCode, isJoiningInvite]);

  useEffect(() => {
    if (!isAuthed || !currentHousehold || !supabase) return;
    const client = supabase;

    const channel = client
      .channel(`household-${currentHousehold.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'fridge_memos',
          filter: `household_id=eq.${currentHousehold.id}`,
        },
        () => refresh(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meal_missions',
          filter: `household_id=eq.${currentHousehold.id}`,
        },
        () => refresh(),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'meal_mission_items',
        },
        () => refresh(),
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [isAuthed, currentHousehold?.id]);

  function authorName(authorId?: string | null) {
    if (!authorId) return '';
    return profiles.find((profile) => profile.id === authorId)?.display_name || '';
  }

  function switchTab(tab: 'home' | 'write' | 'history' | 'templates' | 'family' | 'settings') {
    setActiveTab(tab);
    bottomNavProgressRef.current = 0;
    setBottomNavProgress(0);
    if (tab !== 'templates') {
      setIsTemplateSelectMode(false);
      setSelectedTemplateIds([]);
    }
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  const todayMeals = useMemo(() => {
    return meals.filter((meal) =>
      meal.meal_date === selectedDate && (meal.slot === 'breakfast' || meal.slot === 'dinner'),
    );
  }, [meals, selectedDate]);

  const todaySnacks = useMemo(
    () => meals.filter((meal) => meal.meal_date === selectedDate && meal.slot === 'snack'),
    [meals, selectedDate],
  );

  const selectedDateMemos = useMemo(
    () => memos.filter((memo) => todayKey(new Date(memo.created_at)) === selectedDate),
    [memos, selectedDate],
  );

  const history = useMemo(
    () => meals.filter((meal) => meal.meal_date !== selectedDate).slice(0, 12),
    [meals, selectedDate],
  );

  function openDatePicker() {
    const inputElement = dateInputRef.current;
    if (!inputElement) return;
    const pickerInput = inputElement as HTMLInputElement & { showPicker?: () => void };
    if (pickerInput.showPicker) {
      pickerInput.showPicker();
    } else {
      pickerInput.click();
    }
  }

  function findFavoriteByMenuName(menuName: string) {
    const normalizedName = menuName.trim();
    if (!normalizedName) return undefined;
    return templates.find((template) => template.menu_name.trim() === normalizedName);
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    try {
      await signIn(email, password);
      const profile = await getCurrentProfile();
      if (!profile?.display_name) {
        throw new Error('프로필 정보가 없어요. profile 자동 생성 트리거가 적용됐는지 확인해주세요.');
      }
      const households = await fetchMyHouseholds();
      setCurrentProfile(profile);
      setCurrentHousehold(households[0] || null);
      setIsAuthed(true);
    } catch (error) {
      setMessage(toKoreanAuthError(error, '로그인에 실패했어요.'));
    }
  }

  async function handleSignUp(event: FormEvent) {
    event.preventDefault();
    const name = displayName.trim();
    if (!name) {
      setMessage('이름을 입력해주세요.');
      return;
    }

    try {
      console.info('[dobob signup] submit:start', { email, displayName: name });
      const signUpResult = await signUp(email, password, name);
      console.info('[dobob signup] auth:done', {
        hasUser: Boolean(signUpResult.user),
        hasSession: Boolean(signUpResult.session),
        userId: signUpResult.user?.id,
      });

      if (!signUpResult.session) {
        setMessage(
          '회원가입은 요청됐지만 로그인 세션이 생성되지 않았어요. Supabase Authentication > Email에서 Confirm email이 OFF인지 확인해주세요.',
        );
        return;
      }

      let profile = await getCurrentProfile();
      if (!profile?.display_name) {
        console.warn('[dobob signup] profile:missing_after_signup_try_ensure');
        profile = await ensureProfile(name);
      }

      if (!profile?.display_name) {
        console.warn('[dobob signup] profile:missing_after_ensure');
        setMessage('회원가입은 됐지만 프로필 생성 확인에 실패했어요. 잠시 후 로그인해보거나 profiles trigger를 확인해주세요.');
        setAuthMode('login');
        return;
      }
      console.info('[dobob signup] profile:ready', { profileId: profile.id });
      setCurrentProfile(profile);
      setCurrentHousehold(null);
      setIsAuthed(true);
      setMessage('');
    } catch (error) {
      console.error('[dobob signup] failed', error);
      setMessage(toKoreanAuthError(error, '회원가입에 실패했어요.'));
    }
  }

  async function handleCreateHousehold(event: FormEvent) {
    event.preventDefault();
    const name = householdName.trim();
    if (!name) {
      setMessage('가족방 이름을 입력해주세요.');
      return;
    }

    try {
      const household = await createHousehold(name);
      setCurrentHousehold(household);
      setHouseholdName('');
      setMessage('');
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : '가족방을 만들지 못했어요.');
    }
  }

  async function handleJoinHousehold(event: FormEvent) {
    event.preventDefault();
    const code = inviteCode.trim();
    if (!code) {
      setMessage('초대코드를 입력해주세요.');
      return;
    }

    try {
      const household = await joinHousehold(code);
      setCurrentHousehold(household);
      setInviteCode('');
      setMessage('');
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : '초대코드를 확인해주세요.');
    }
  }

  async function handleCopyInviteLink() {
    if (!currentHousehold) return;
    const link = inviteLink(currentHousehold.invite_code);

    try {
      await navigator.clipboard.writeText(link);
      setMessage('초대 링크를 복사했어요.');
      setIsMenuOpen(false);
    } catch (error) {
      console.error(error);
      setMessage(link);
    }
  }

  async function handleShareInviteLink() {
    if (!currentHousehold) return;
    const link = inviteLink(currentHousehold.invite_code);

    if (!navigator.share) {
      await handleCopyInviteLink();
      return;
    }

    try {
      await navigator.share({
        title: '도밥도밥 초대',
        text: `${currentHousehold.name} 냉장고 보드에 초대할게요.`,
        url: link,
      });
      setIsMenuOpen(false);
    } catch (error) {
      console.info('[dobob invite] share canceled or failed', error);
    }
  }

  async function handleEnablePush() {
    try {
      await registerPushSubscription();
      setPushStatus(getPushStatus());
      setMessage('알림을 켰어요. 새 식사와 메모를 받을 수 있어요.');
      setIsNotificationOpen(false);
    } catch (error) {
      console.error('[dobob push] subscribe failed', error);
      setPushStatus(getPushStatus());
      setMessage(error instanceof Error ? error.message : '알림 설정을 완료하지 못했어요.');
    }
  }

  async function handleSaveDisplayName(event: FormEvent) {
    event.preventDefault();
    const nextName = settingsDisplayName.trim();
    if (!nextName) {
      setMessage('이름을 입력해주세요.');
      return;
    }

    try {
      const updatedProfile = await updateProfileDisplayName(nextName);
      setCurrentProfile(updatedProfile);
      setProfiles((current) => current.map((profile) => (
        profile.id === updatedProfile.id ? updatedProfile : profile
      )));
      setMessage('이름을 저장했어요.');
    } catch (error) {
      console.error('[dobob profile] update display name failed', error);
      setMessage(error instanceof Error ? error.message : '이름을 저장하지 못했어요.');
    }
  }

  async function handleLogout() {
    await signOut();
    setCurrentProfile(null);
    setCurrentHousehold(null);
    setIsAuthed(false);
    setIsMenuOpen(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!currentProfile || !currentHousehold) {
      setMessage('로그인과 가족방 정보를 확인해주세요.');
      return;
    }
    const menuName = input.menu_name.trim();
    if (!menuName) {
      setMessage('메뉴명을 입력해주세요.');
      requestAnimationFrame(() => {
        document.getElementById('meal-menu-name')?.focus();
        document.querySelector('.form-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }

    try {
      console.info('[dobob meal] submit:start', {
        householdId,
        authorId: currentProfile.id,
        editingId: editing?.id,
        menuName: input.menu_name,
        itemCount: input.items.length,
        items: input.items,
      });
      const normalizedInput = compactMealInput(input, menuName);
      console.log('[dobob meal] normalized input before save', {
        normalizedInput,
        slot: normalizedInput.slot,
        meal_type: (normalizedInput as Record<string, unknown>).meal_type,
        category: (normalizedInput as Record<string, unknown>).category,
        mission_type: (normalizedInput as Record<string, unknown>).mission_type,
      });
      const savedMeal = await upsertMeal(householdId, normalizedInput, currentProfile.id, editing?.id);
      const editingMealId = editing?.id;
      const linkedFavorite = editing ? findFavoriteByMenuName(editing.menu_name) : undefined;
      if (linkedFavorite) {
        try {
          const updatedTemplate = await saveTemplate(householdId, normalizedInput, currentProfile.id, linkedFavorite.id);
          setTemplates((prev) => [updatedTemplate, ...prev.filter((template) => template.id !== updatedTemplate.id)]);
        } catch (favoriteError) {
          console.warn('[dobob template] sync after meal edit failed', {
            error: favoriteError,
            templateId: linkedFavorite.id,
            mealId: editingMealId,
          });
        }
      }
      console.info('[dobob meal] submit:success');
      setMeals((prev) => {
        const withoutPrevious = prev.filter((meal) => meal.id !== savedMeal.id);
        return [savedMeal, ...withoutPrevious];
      });
      setEditing(null);
      setInput({ ...defaultInput, slot: input.slot });
      setMessage(input.slot === 'snack'
        ? editing ? '간식을 수정했어요' : '간식을 등록했어요'
        : editing ? '식사를 수정했어요' : '식사를 등록했어요');
      switchTab('home');
      try {
        await refresh();
      } catch (refreshError) {
        console.warn('[dobob meal] submit:refresh warning', {
          error: refreshError,
          savedMealId: savedMeal.id,
          householdId,
        });
      }
    } catch (error) {
      console.error('[dobob meal] submit:failed', {
        error,
        rawError: error,
        errorMessage: error instanceof Error ? error.message : undefined,
        householdId,
        authorId: currentProfile.id,
        editingId: editing?.id,
        input,
        normalizedInput: compactMealInput(input, menuName),
      });
      setMessage(input.slot === 'snack'
        ? editing ? '간식을 수정하지 못했어요' : '간식을 등록하지 못했어요'
        : editing ? '식사를 수정하지 못했어요' : '식사를 등록하지 못했어요');
      requestAnimationFrame(() => {
        document.querySelector('.form-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }

  async function handleSaveFavorite(source: MealInput) {
    if (!currentProfile || !currentHousehold) return;
    const menuName = source.menu_name.trim();
    if (!menuName) {
      setMessage('메뉴명을 먼저 입력해주세요.');
      return;
    }

    const normalizedInput = compactMealInput(source, menuName);
    const existingTemplate = findFavoriteByMenuName(menuName);

    try {
      if (existingTemplate) {
        const previousTemplates = templates;
        setTemplates((prev) => prev.filter((template) => template.id !== existingTemplate.id));
        try {
          await deleteTemplate(existingTemplate.id);
          setMessage('즐겨찾기를 해제했어요');
          await refresh();
        } catch (deleteError) {
          setTemplates(previousTemplates);
          throw deleteError;
        }
        return;
      }

      const savedTemplate = await saveTemplate(
        householdId,
        {
          menu_name: menuName,
          note: normalizedInput.note,
          items: normalizedInput.items,
        },
        currentProfile.id,
      );
      setTemplates((prev) => [savedTemplate, ...prev.filter((template) => template.id !== savedTemplate.id)]);
      setMessage('즐겨찾기에 저장했어요');
      await refresh();
    } catch (error) {
      console.error('[dobob template] save failed', error);
      setMessage(existingTemplate ? '즐겨찾기를 해제하지 못했어요' : '즐겨찾기에 저장하지 못했어요');
    }
  }

  async function handleDeleteTemplate(template: MenuTemplate) {
    if (!confirm('이 즐겨찾기를 삭제할까요?')) return;
    try {
      await deleteTemplate(template.id);
      setMessage('즐겨찾기를 해제했어요');
      await refresh();
    } catch (error) {
      console.error('[dobob template] delete failed', error);
      setMessage('즐겨찾기를 해제하지 못했어요');
    }
  }

  function enterTemplateSelectMode() {
    setIsTemplateSelectMode(true);
    setSelectedTemplateIds([]);
  }

  function cancelTemplateSelectMode() {
    setIsTemplateSelectMode(false);
    setSelectedTemplateIds([]);
  }

  function toggleTemplateSelection(templateId: string) {
    setSelectedTemplateIds((prev) => (
      prev.includes(templateId) ? prev.filter((id) => id !== templateId) : [...prev, templateId]
    ));
  }

  function toggleAllTemplates() {
    setSelectedTemplateIds((prev) => (
      prev.length === templates.length ? [] : templates.map((template) => template.id)
    ));
  }

  async function handleDeleteSelectedTemplates() {
    if (selectedTemplateIds.length === 0) return;
    if (!confirm('선택한 항목을 삭제할까요?')) return;
    const idsToDelete = selectedTemplateIds;
    const previousTemplates = templates;
    try {
      setTemplates((prev) => prev.filter((template) => !idsToDelete.includes(template.id)));
      await deleteTemplates(idsToDelete);
      setMessage('선택한 항목을 삭제했어요');
      cancelTemplateSelectMode();
      await refresh();
    } catch (error) {
      setTemplates(previousTemplates);
      console.error('[dobob template] bulk delete failed', { error, templateIds: idsToDelete });
      setMessage('선택한 항목을 삭제하지 못했어요');
    }
  }

  async function handleAddTemplateToday(template: MenuTemplate) {
    if (!currentProfile || !currentHousehold) return;
    try {
      await upsertMeal(
        householdId,
        templateToInput(template, { meal_date: selectedDate, slot: input.slot }),
        currentProfile.id,
      );
      switchTab('home');
      setMessage('식사를 불러왔어요');
      await refresh();
    } catch (error) {
      console.error('[dobob template] add today failed', error);
      setMessage('식사를 불러오지 못했어요');
    }
  }

  function handleCopyMeal(meal: MealMission) {
    setEditing(null);
    setInput(mealToInput(meal, { meal_date: selectedDate }));
    switchTab('write');
    setMessage('지난 식사를 불러왔어요. 날짜와 시간대만 살짝 고쳐 저장해보세요.');
  }

  async function handleAddMemo() {
    const body = memoBody.trim();
    if (!body) return;

    if (!currentProfile || !currentHousehold) {
      console.error('[dobob memo] missing auth or household', {
        hasProfile: Boolean(currentProfile),
        hasHousehold: Boolean(currentHousehold),
        householdId,
      });
      setMessage('로그인과 가족방 정보를 확인해주세요.');
      return;
    }

    try {
      console.info('[dobob memo] add:start', {
        householdId,
        authorId: currentProfile.id,
        length: body.length,
      });
      const savedMemo = await upsertMemo(householdId, { text: body }, currentProfile.id);
      console.info('[dobob memo] add:success', {
        memoId: savedMemo.id,
        householdId: savedMemo.household_id,
      });
      setMemos((prev) => [savedMemo, ...prev]);
      void notifyHouseholdPush({
        kind: 'memo_created',
        householdId,
        title: `${currentProfile.display_name}님이 새 메모를 등록했어요`,
        body,
        url: '/',
        sourceId: savedMemo.id,
      }).catch((pushError) => {
        console.warn('[dobob push] memo notification failed', pushError);
      });
      setMemoBody('');
      setMessage('메모를 남겼어요');
      await refresh(Math.max(memos.length + 1, MEMO_PAGE_SIZE));
    } catch (error) {
      console.error('[dobob memo] add:failed', {
        error,
        householdId,
        authorId: currentProfile.id,
        text: body,
      });
      setMessage('메모를 남기지 못했어요');
    }
  }

  function handleMemoSubmit(event: FormEvent) {
    event.preventDefault();
    handleAddMemo();
  }

  async function handleDeleteMeal(meal: MealMission) {
    const isSnack = meal.slot === 'snack';
    if (!confirm(isSnack ? '이 간식을 삭제할까요?' : '이 식사를 삭제할까요?')) return;
    try {
      await deleteMeal(meal.id);
      if (editing?.id === meal.id) {
        setEditing(null);
        setInput({ ...defaultInput });
      }
      setMessage(isSnack ? '간식을 삭제했어요' : '식사를 삭제했어요');
      await refresh();
    } catch (error) {
      console.error('[dobob meal] delete failed', error);
      setMessage(isSnack ? '간식을 삭제하지 못했어요' : '식사를 삭제하지 못했어요');
    }
  }

  async function handleDeleteMemo(memo: FridgeMemo) {
    if (!confirm('이 메모를 삭제할까요?')) return;
    try {
      await deleteMemo(memo.id);
      setMemos((prev) => prev.filter((item) => item.id !== memo.id));
      setMessage('메모를 삭제했어요');
      await refresh(Math.max(memos.length, MEMO_PAGE_SIZE));
    } catch (error) {
      console.error('[dobob memo] delete failed', error);
      setMessage('메모를 삭제하지 못했어요');
    }
  }

  function enterMemoSelectMode(memoId?: string) {
    setIsMemoSelectMode(true);
    if (memoId) {
      setSelectedMemoIds((prev) => (prev.includes(memoId) ? prev : [...prev, memoId]));
    }
  }

  function toggleMemoSelection(memoId: string) {
    setSelectedMemoIds((prev) =>
      prev.includes(memoId) ? prev.filter((id) => id !== memoId) : [...prev, memoId],
    );
  }

  function selectAllVisibleMemos() {
    setIsMemoSelectMode(true);
    setSelectedMemoIds(selectedDateMemos.map((memo) => memo.id));
  }

  function clearMemoSelection() {
    setSelectedMemoIds([]);
  }

  function cancelMemoSelection() {
    setIsMemoSelectMode(false);
    setSelectedMemoIds([]);
  }

  async function handleDeleteSelectedMemos() {
    if (selectedMemoIds.length === 0) return;
    if (!confirm('선택한 항목을 삭제할까요?')) return;
    try {
      await deleteMemos(selectedMemoIds);
      setMemos((prev) => prev.filter((memo) => !selectedMemoIds.includes(memo.id)));
      setMessage('선택한 항목을 삭제했어요');
      const nextLimit = Math.max(memos.length, MEMO_PAGE_SIZE);
      cancelMemoSelection();
      await refresh(nextLimit);
    } catch (error) {
      console.error('[dobob memo] bulk delete failed', {
        error,
        selectedMemoIds,
        householdId,
      });
      setMessage('선택한 항목을 삭제하지 못했어요');
    }
  }

  async function handleLoadMoreMemos() {
    if (!currentHousehold || isMemoLoading || !hasMoreMemos) return;
    try {
      setIsMemoLoading(true);
      const result = await fetchMemos(currentHousehold.id, memos.length, MEMO_PAGE_SIZE);
      setMemos((prev) => [...prev, ...result.memos]);
      setHasMoreMemos(result.hasMore);
    } catch (error) {
      console.error('[dobob memo] load more failed', {
        error,
        householdId: currentHousehold.id,
        offset: memos.length,
      });
      setMessage(error instanceof Error ? error.message : '메모를 더 불러오지 못했어요.');
    } finally {
      setIsMemoLoading(false);
    }
  }

  async function handleUpdateMemo(memo: FridgeMemo, text: string) {
    const body = text.trim();
    if (!body) {
      setMessage('메모 내용을 입력해주세요.');
      return false;
    }

    if (!currentProfile || !currentHousehold) {
      setMessage('로그인과 가족방 정보를 확인해주세요.');
      return false;
    }

    try {
      console.info('[dobob memo] update:start', {
        memoId: memo.id,
        householdId,
        authorId: memo.author_id || currentProfile.id,
        length: body.length,
      });
      const savedMemo = await upsertMemo(
        householdId,
        { text: body },
        memo.author_id || currentProfile.id,
        memo.id,
      );
      setMemos((prev) =>
        prev.map((item) =>
          item.id === memo.id
            ? { ...item, text: savedMemo.text, author_id: savedMemo.author_id }
            : item,
        ),
      );
      setMessage('메모를 수정했어요');
      await refresh(Math.max(memos.length, MEMO_PAGE_SIZE));
      return true;
    } catch (error) {
      console.error('[dobob memo] update:failed', {
        error,
        memoId: memo.id,
        householdId,
        text: body,
      });
      setMessage('메모를 수정하지 못했어요');
      return false;
    }
  }

  async function handleScheduleMemoReminder(memo: FridgeMemo, remindAt: string) {
    if (!currentProfile || !currentHousehold) {
      setMessage('로그인과 가족방 정보를 확인해주세요.');
      return false;
    }

    try {
      await scheduleMemoReminder({
        memoId: memo.id,
        householdId,
        senderId: currentProfile.id,
        remindAt: new Date(remindAt).toISOString(),
      });
      setMessage('알림을 예약했어요.');
      await refresh(Math.max(memos.length, MEMO_PAGE_SIZE));
      return true;
    } catch (error) {
      console.error('[dobob memo] schedule reminder failed', {
        error,
        memoId: memo.id,
        remindAt,
        householdId,
      });
      setMessage(error instanceof Error ? error.message : '알림을 예약하지 못했어요.');
      return false;
    }
  }

  function startEdit(meal?: MealMission, slot?: MealSlot) {
    if (meal) {
      setEditing(meal);
      setInput(mealToInput(meal));
    } else {
      setEditing(null);
      setInput({ ...defaultInput, meal_date: selectedDate, slot: slot || 'breakfast' });
    }
    switchTab('write');
  }

  function applyTemplate(template: MenuTemplate) {
    console.info('[dobob template] apply', {
      templateId: template.id,
      menuName: template.menu_name,
      itemCount: template.items.length,
    });
    setInput(templateToInput(template, { meal_date: input.meal_date, slot: input.slot }));
    switchTab('write');
  }

  if (isAuthLoading) {
    return (
      <main className="auth-shell">
        <section className="login-card paper-card">
          <img className="app-mark-image" src="/icons/dobob/svg_wrapped/meals/meal-rice.svg" alt="" aria-hidden="true" />
          <h1 className="brand-title">도밥도밥</h1>
          <p className="login-copy">식사 · 간식 · 메모</p>
        </section>
      </main>
    );
  }

  if (!isAuthed) {
    return (
      <main className="auth-shell">
        <section className="login-card paper-card">
          <img className="app-mark-image" src="/icons/dobob/svg_wrapped/meals/meal-rice.svg" alt="" aria-hidden="true" />
          <h1 className="brand-title">{authMode === 'login' ? '도밥도밥' : '회원가입'}</h1>
          <p className="login-copy">
            식사 · 간식 · 메모
          </p>
          {pendingInviteCode && (
            <p className="invite-hint">
              초대 링크 #{pendingInviteCode}로 들어왔어요. 로그인 후 자동으로 가족방에 참여해요.
            </p>
          )}
          <form onSubmit={authMode === 'login' ? handleLogin : handleSignUp} className="login-form">
            {authMode === 'signup' && (
              <label>
                이름
                <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
              </label>
            )}
            <label>
              이메일
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
            </label>
            <label>
              비밀번호
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
            </label>
            <button className="primary-button" type="submit">{authMode === 'login' ? '로그인' : '회원가입'}</button>
          </form>
          {message && <p className="error-text">{message}</p>}
          <button
            className="auth-switch"
            type="button"
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'signup' : 'login');
              setMessage('');
            }}
          >
            {authMode === 'login' ? '계정이 없나요? 회원가입' : '이미 계정이 있나요? 로그인'}
          </button>
        </section>
      </main>
    );
  }

  if (!currentHousehold) {
    return (
      <main className="auth-shell onboarding-shell">
        <section className="login-card paper-card">
          <img className="app-mark-image" src="/icons/dobob/svg_wrapped/meals/meal-rice.svg" alt="" aria-hidden="true" />
          <p className="eyebrow">family board setup</p>
          <h1 className="brand-title">가족방 시작하기</h1>
          <p className="login-copy">
            {currentProfile?.display_name}님, 함께 쓸 냉장고 보드를 만들거나 초대코드로 참여해주세요.
          </p>
          {pendingInviteCode && (
            <p className="invite-hint">
              {isJoiningInvite
                ? `초대 링크 #${pendingInviteCode}로 가족방에 참여하는 중이에요.`
                : `초대 링크 #${pendingInviteCode}로 참여할 준비가 됐어요.`}
            </p>
          )}

          <div className="onboarding-grid">
            <form className="login-form onboarding-card" onSubmit={handleCreateHousehold}>
              <h2>가족방 만들기</h2>
              <p>우리 집만의 식사와 메모가 따로 저장돼요.</p>
              <label>
                가족방 이름
                <input
                  value={householdName}
                  onChange={(event) => setHouseholdName(event.target.value)}
                  placeholder="예: 소은이네 냉장고"
                />
              </label>
              <button className="primary-button" type="submit">만들기</button>
            </form>

            <form className="login-form onboarding-card" onSubmit={handleJoinHousehold}>
              <h2>초대코드로 참여</h2>
              <p>이미 만들어진 가족방에 들어가요.</p>
              <label>
                초대코드
                <input
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                  placeholder="예: DOBAB7"
                />
              </label>
              <button className="primary-button secondary" type="submit">참여하기</button>
            </form>
          </div>

          {message && <p className="error-text">{message}</p>}
          <button
            className="auth-switch"
            type="button"
            onClick={async () => {
              await signOut();
              setCurrentProfile(null);
              setCurrentHousehold(null);
              setIsAuthed(false);
              setMessage('');
            }}
          >
            다른 계정으로 로그인
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <button className="header-icon" aria-label="메뉴" onClick={() => setIsMenuOpen((open) => !open)}>
          <Menu size={22} />
        </button>
        {isMenuOpen && (
          <div className="header-menu">
            <button type="button" onClick={handleCopyInviteLink}>
              초대 링크 복사
            </button>
            <button type="button" onClick={handleShareInviteLink}>
              공유하기
            </button>
            <button
              type="button"
              onClick={async () => {
                await signOut();
                setCurrentProfile(null);
                setCurrentHousehold(null);
                setIsAuthed(false);
                setIsMenuOpen(false);
              }}
            >
              로그아웃
            </button>
          </div>
        )}
        <div className="brand-logo">
          <span className="brand-title">도밥도밥</span>
        </div>
        {currentProfile && (
          <p className="current-user">
            {currentProfile.display_name} · {currentHousehold.name} #{currentHousehold.invite_code}
          </p>
        )}
        <button
          className="header-icon notify-icon"
          aria-label="알림"
          onClick={() => setIsNotificationOpen((open) => !open)}
        >
          <Bell size={21} />
        </button>
        {isNotificationOpen && (
          <div className="notification-menu">
            <p>
              {pushStatus === 'granted'
                ? '메모 알림이 켜져 있어요.'
                : pushStatus === 'denied'
                  ? '알림 권한이 꺼져 있어요. 브라우저 설정에서 다시 켜주세요.'
                  : pushStatus === 'unsupported'
                    ? '이 브라우저는 메모 알림을 지원하지 않아요.'
                    : '메모에 예약한 알림을 받을 수 있어요.'}
            </p>
            {pushStatus !== 'granted' && pushStatus !== 'unsupported' && pushStatus !== 'missing-key' && (
              <button type="button" onClick={handleEnablePush}>
                알림 켜기
              </button>
            )}
          </div>
        )}
      </header>

      {message && <p className="app-message">{message}</p>}

      <section className="main-content">
        {activeTab === 'home' && (
          <>
          <section className="mission-head">
            <div>
              <button className="date-picker-button" type="button" onClick={openDatePicker}>
                {formatKoreanDate(selectedDate)}
              </button>
              <input
                ref={dateInputRef}
                className="date-picker-input"
                value={selectedDate}
                onChange={(event) => setSelectedDate(event.target.value || todayKey())}
                type="date"
                aria-label="날짜 선택"
              />
              <h2>식사</h2>
            </div>
            <button className="section-add-button" type="button" onClick={() => startEdit()}>+ 추가</button>
          </section>

          <section className="today-grid">
            {todayMeals.length > 0 ? (
              todayMeals.map((meal) => (
                <MealCard
                  key={meal.id}
                  meal={meal}
                  slot={meal.slot}
                  onEdit={() => startEdit(meal)}
                  onDelete={() => handleDeleteMeal(meal)}
                  isFavorite={Boolean(findFavoriteByMenuName(meal.menu_name))}
                  onFavorite={() => handleSaveFavorite(mealToInput(meal))}
                />
              ))
            ) : (
              <InlineEmptyNote text="아직 등록된 식사가 없어요" icon="/icons/dobob/svg_wrapped/empty/empty-meal.svg" />
            )}
          </section>

          <section className="snack-board">
            <div className="section-title compact">
              <div>
                <h2>간식</h2>
              </div>
              <button className="section-add-button" type="button" onClick={() => startEdit(undefined, 'snack')}>+ 추가</button>
            </div>
            {todaySnacks.length > 0 ? (
              <div className="snack-list">
                {todaySnacks.map((snack) => (
                  <SnackCard
                    key={snack.id}
                    snack={snack}
                    onEdit={() => startEdit(snack)}
                    onDelete={() => handleDeleteMeal(snack)}
                  />
                ))}
              </div>
            ) : (
              <InlineEmptyNote text="아직 등록된 간식이 없어요" icon="/icons/dobob/svg_wrapped/empty/empty-snack.svg" />
            )}
          </section>

          <FridgeMemoBoard
            memos={selectedDateMemos}
            reminders={memoReminders}
            memoBody={memoBody}
            setMemoBody={setMemoBody}
            onSubmit={handleMemoSubmit}
            onAdd={handleAddMemo}
            authorName={authorName}
            currentName={currentProfile?.display_name || ''}
            onUpdate={handleUpdateMemo}
            onScheduleReminder={handleScheduleMemoReminder}
            onDelete={handleDeleteMemo}
            hasMore={hasMoreMemos}
            isLoadingMore={isMemoLoading}
            onLoadMore={handleLoadMoreMemos}
            isSelectMode={isMemoSelectMode}
            selectedIds={selectedMemoIds}
            onEnterSelectMode={enterMemoSelectMode}
            onToggleSelect={toggleMemoSelection}
            onSelectAll={selectAllVisibleMemos}
            onClearSelection={clearMemoSelection}
            onDeleteSelected={handleDeleteSelectedMemos}
            onCancelSelect={cancelMemoSelection}
          />
          </>
        )}

        {activeTab === 'write' && (
          <MealForm
            input={input}
            editing={editing}
            templates={templates}
            setInput={setInput}
            onSubmit={handleSubmit}
            onTemplate={applyTemplate}
            onAddTemplateToday={handleAddTemplateToday}
            onDeleteTemplate={handleDeleteTemplate}
            onSaveFavorite={() => handleSaveFavorite(input)}
          />
        )}

        {activeTab === 'history' && (
          <section className="stack">
            {history.length === 0 && <EmptyNote text="아직 지난 식사가 없어요" icon="/icons/dobob/svg_wrapped/empty/empty-meal.svg" />}
            {history.map((meal) => (
              <MealCard key={meal.id} meal={meal} slot={meal.slot} compact onEdit={() => startEdit(meal)} onDelete={() => handleDeleteMeal(meal)} isFavorite={Boolean(findFavoriteByMenuName(meal.menu_name))} onFavorite={() => handleSaveFavorite(mealToInput(meal))} />
            ))}
          </section>
        )}

        {activeTab === 'templates' && (
          <section className="stack favorite-page">
            <div className="favorite-page-head">
              <div>
                <p className="eyebrow">빠르게 불러오는 메뉴</p>
                <h2>즐겨찾기</h2>
              </div>
              {templates.length > 0 && !isTemplateSelectMode && (
                <button className="select-mode-button" type="button" onClick={enterTemplateSelectMode}>
                  선택
                </button>
              )}
            </div>
            {isTemplateSelectMode && (
              <div className="memo-select-bar favorite-select-bar">
                <button type="button" onClick={cancelTemplateSelectMode}>← 취소</button>
                <strong>{selectedTemplateIds.length}개 선택됨</strong>
                <div className="memo-select-actions">
                  <button type="button" onClick={toggleAllTemplates}>
                    {selectedTemplateIds.length === templates.length ? '전체 해제' : '전체 선택'}
                  </button>
                  <button type="button" className="danger" disabled={selectedTemplateIds.length === 0} onClick={handleDeleteSelectedTemplates}>
                    삭제
                  </button>
                </div>
              </div>
            )}
            {templates.length === 0 && <EmptyNote text="아직 즐겨찾기한 식사가 없어요" icon="/icons/dobob/svg_wrapped/empty/empty-meal.svg" />}
            {templates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onApply={() => applyTemplate(template)}
                onEdit={() => applyTemplate(template)}
                onDelete={() => handleDeleteTemplate(template)}
                isSelectMode={isTemplateSelectMode}
                isSelected={selectedTemplateIds.includes(template.id)}
                onToggleSelect={() => toggleTemplateSelection(template.id)}
              />
            ))}
            {isTemplateSelectMode && (
              <div className="favorite-delete-dock">
                <button type="button" disabled={selectedTemplateIds.length === 0} onClick={handleDeleteSelectedTemplates}>
                  선택한 항목 삭제
                </button>
              </div>
            )}
          </section>
        )}

        {activeTab === 'family' && (
          <section className="utility-page family-page">
            <div className="utility-page-head">
              <p className="eyebrow">함께 쓰는 공간</p>
              <h2>가족방</h2>
            </div>

            <section className="utility-card family-summary-card">
              <div>
                <span className="utility-label">가족방 이름</span>
                <h3>{currentHousehold.name}</h3>
              </div>
              <div className="invite-code-block">
                <span className="utility-label">초대코드</span>
                <strong>#{currentHousehold.invite_code}</strong>
              </div>
              <div className="invite-link-row">
                <span>{inviteLink(currentHousehold.invite_code)}</span>
                <button type="button" onClick={handleCopyInviteLink}>초대 링크 복사</button>
              </div>
            </section>

            <section className="utility-card">
              <div className="utility-section-head">
                <h3>참여 멤버</h3>
                <span>{profiles.length}명</span>
              </div>
              <div className="member-list">
                {profiles.map((profile) => (
                  <div className="member-row" key={profile.id}>
                    <span className="member-avatar" aria-hidden="true">{profile.display_name.slice(0, 1)}</span>
                    <div>
                      <strong>{profile.display_name}</strong>
                      {profile.id === currentProfile?.id && <small>나</small>}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <button
              className="quiet-danger-button"
              type="button"
              onClick={() => setMessage('가족방 나가기 기능은 준비 중이에요.')}
            >
              가족방 나가기
            </button>
          </section>
        )}

        {activeTab === 'settings' && (
          <section className="utility-page settings-page">
            <div className="utility-page-head">
              <p className="eyebrow">도밥도밥 설정</p>
              <h2>설정</h2>
            </div>

            <section className="utility-card">
              <h3>내 정보</h3>
              <form className="settings-name-form" onSubmit={handleSaveDisplayName}>
                <label htmlFor="settings-display-name">이름</label>
                <div>
                  <input
                    id="settings-display-name"
                    value={settingsDisplayName}
                    onChange={(event) => setSettingsDisplayName(event.target.value)}
                    placeholder="이름을 입력해주세요"
                  />
                  <button type="submit">저장</button>
                </div>
              </form>
            </section>

            <section className="utility-card">
              <div className="utility-section-head">
                <div>
                  <h3>메모 알림</h3>
                  <p>{pushStatus === 'granted' ? '알림이 켜져 있어요.' : '알림이 꺼져 있어요.'}</p>
                </div>
                <Bell size={20} aria-hidden="true" />
              </div>
              <div className="settings-action-row">
                <button type="button" onClick={handleEnablePush} disabled={pushStatus === 'granted'}>
                  {pushStatus === 'granted' ? '알림 켜짐' : '알림 켜기'}
                </button>
                <button type="button" onClick={() => setMessage('알림 테스트 기능은 준비 중이에요.')}>알림 테스트</button>
              </div>
            </section>

            <section className="utility-card app-info-card">
              <h3>앱 정보</h3>
              <dl>
                <div><dt>버전</dt><dd>v0.1.0</dd></div>
                <div><dt>사용 폰트</dt><dd>오뮤 다예쁨 / © omyudiary</dd></div>
              </dl>
              <p>폰트 저작권은 오뮤다이어리 및 ㈜보이저엑스에 있습니다.</p>
            </section>

            <section className="utility-card account-card">
              <h3>계정</h3>
              <button type="button" onClick={handleLogout}>
                <LogOut size={18} /> 로그아웃
              </button>
            </section>
          </section>
        )}
      </section>

      <nav className="bottom-nav" style={bottomNavStyle} aria-label="주 메뉴">
        <TabButton active={activeTab === 'history'} label="지난" icon={History} onClick={() => switchTab('history')} />
        <TabButton active={activeTab === 'templates'} label="즐겨찾기" icon={Star} onClick={() => switchTab('templates')} />
        <TabButton active={activeTab === 'home'} label="홈" icon={Home} onClick={() => switchTab('home')} featured />
        <TabButton active={activeTab === 'family'} label="가족방" icon={Users} onClick={() => switchTab('family')} />
        <TabButton active={activeTab === 'settings'} label="설정" icon={Settings} onClick={() => switchTab('settings')} />
      </nav>
    </main>
  );
}

function MealCard({
  meal,
  slot,
  compact,
  onEdit,
  onDelete,
  isFavorite,
  onFavorite,
}: {
  meal?: MealMission;
  slot: MealSlot;
  compact?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  isFavorite?: boolean;
  onFavorite?: () => void;
}) {
  if (!meal) {
    return (
      <article className="meal-card empty-card">
        <div className="card-title">
          <span>{slotLabel[slot]}</span>
          <button className="ghost-button" onClick={onEdit} aria-label="식사 쓰기">
            <Plus size={17} />
          </button>
        </div>
        <p>아직 등록된 식사가 없어요</p>
      </article>
    );
  }

  const storageText = storageLabels(meal.items.flatMap((item) => item.storage_tags));

  return (
    <article className={`meal-card ${compact ? 'compact' : ''}`}>
      <div className="card-title">
        <span>{slotLabel[slot]}</span>
        <div className="card-actions">
          <button className="ghost-button" onClick={onEdit} aria-label="수정">
            <Edit3 size={17} />
          </button>
          {onFavorite && (
            <button
              className={`ghost-button favorite-button ${isFavorite ? 'is-favorite' : ''}`}
              onClick={onFavorite}
              aria-label={isFavorite ? '즐겨찾기 업데이트' : '즐겨찾기 저장'}
              title={isFavorite ? '즐겨찾기 저장됨' : '즐겨찾기 저장'}
            >
              <Star size={17} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          )}
          <button className="ghost-button" onClick={onDelete} aria-label="삭제">
            <Trash2 size={17} />
          </button>
        </div>
      </div>
      <div className="food-text meal-title-block">
        <h3 className="menu-title-with-icon">
          <span>{meal.menu_name}</span>
          <img
            className="food-icon meal-card-icon"
            src={iconPathFromMenuName(meal.menu_name, 'meals/meal-rice.svg')}
            alt=""
            aria-hidden="true"
          />
        </h3>
        {storageText && <p className="meal-storage-line">{storageText}</p>}
      </div>
      <div className="mission-items">
        {meal.items.length > 0 ? (
          meal.items.map((item) => (
            <div className="mission-item" key={item.id || `${meal.id}-${item.sort_order}`}>
              <img className="mission-item-icon" src={iconPathFromMenuName(item.name || meal.menu_name)} alt="" aria-hidden="true" />
              <div>
                <strong>{item.name}</strong>
                <p>
                  {[item.amount, item.location, item.prep].filter(Boolean).join(' · ') || '준비 메모 없음'}
                </p>
                <div className="chip-row">
                  <Tag values={item.storage_tags} type="storage" />
                  <Tag values={item.prep_tags} type="prep" />
                </div>
              </div>
            </div>
          ))
        ) : null}
      </div>
      {meal.note && <p className="meal-note">{meal.note}</p>}
    </article>
  );
}

function TemplateCard({
  template,
  onApply,
  onEdit,
  onDelete,
  isSelectMode,
  isSelected,
  onToggleSelect,
}: {
  template: MenuTemplate;
  onApply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isSelectMode: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  const storage = storageLabels(template.storage_tags || template.items.flatMap((item) => item.storage_tags));
  const handleCardClick = () => {
    if (isSelectMode) {
      onToggleSelect();
      return;
    }
    onApply();
  };

  return (
    <article
      className={`template-card ${isSelectMode ? 'selectable' : ''} ${isSelected ? 'selected' : ''}`}
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleCardClick();
        }
      }}
    >
      {isSelectMode && (
        <span className="template-check" aria-hidden="true">
          {isSelected ? '✓' : ''}
        </span>
      )}
      <span className="template-emoji">
        <img src={iconPathFromMenuName(template.menu_name)} alt="" aria-hidden="true" />
      </span>
      <div className="template-copy">
        <span>{template.menu_name}</span>
        <small>{storage ? `📍 ${storage}` : template.note || '자주 쓰는 메뉴'}</small>
      </div>
      {!isSelectMode && (
        <div className="template-actions">
          <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(); }} aria-label="즐겨찾기 수정">
            <Edit3 size={16} />
          </button>
          <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(); }} aria-label="즐겨찾기 삭제">
            <Trash2 size={16} />
          </button>
        </div>
      )}
    </article>
  );
}

function SnackCard({
  snack,
  onEdit,
  onDelete,
}: {
  snack: MealMission;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const storage = storageLabels(snack.items.flatMap((item) => item.storage_tags));
  const metaText = [storage && `📍 ${storage}`, snack.note].filter(Boolean).join(' · ');
  const pressTimerRef = useRef<number | null>(null);
  const didLongPressRef = useRef(false);

  function clearPressTimer() {
    if (pressTimerRef.current) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }

  function startLongPress() {
    clearPressTimer();
    didLongPressRef.current = false;
    const timer = window.setTimeout(() => {
      pressTimerRef.current = null;
      didLongPressRef.current = true;
      onDelete();
    }, 650);
    pressTimerRef.current = timer;
  }

  function handleClick() {
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }
    onEdit();
  }

  return (
    <button
      className="snack-row"
      type="button"
      onClick={handleClick}
      onMouseDown={startLongPress}
      onMouseUp={clearPressTimer}
      onMouseLeave={clearPressTimer}
      onTouchStart={startLongPress}
      onTouchEnd={clearPressTimer}
      onTouchCancel={clearPressTimer}
      aria-label={`${snack.menu_name} 수정. 길게 누르면 삭제`}
    >
      <div className="food-text snack-title-row snack-row-main">
        <strong className="menu-title-with-icon">
          <span>{snack.menu_name}</span>
          <span className="food-icon snack-row-emoji">
            <img src={iconPathFromMenuName(snack.menu_name)} alt="" aria-hidden="true" />
          </span>
        </strong>
        {metaText && <small>{metaText}</small>}
      </div>
      <time>{formatMemoTime(snack.created_at || new Date().toISOString())}</time>
    </button>
  );
}

function FridgeMemoBoard({
  memos,
  reminders,
  memoBody,
  setMemoBody,
  onSubmit,
  onAdd,
  authorName,
  currentName,
  onUpdate,
  onScheduleReminder,
  onDelete,
  hasMore,
  isLoadingMore,
  onLoadMore,
  isSelectMode,
  selectedIds,
  onEnterSelectMode,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onDeleteSelected,
  onCancelSelect,
}: {
  memos: FridgeMemo[];
  reminders: MemoReminder[];
  memoBody: string;
  setMemoBody: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onAdd: () => void;
  authorName: (authorId?: string | null) => string;
  currentName: string;
  onUpdate: (memo: FridgeMemo, text: string) => Promise<boolean>;
  onScheduleReminder: (memo: FridgeMemo, remindAt: string) => Promise<boolean>;
  onDelete: (memo: FridgeMemo) => void;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  isSelectMode: boolean;
  selectedIds: string[];
  onEnterSelectMode: (memoId?: string) => void;
  onToggleSelect: (memoId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onCancelSelect: () => void;
}) {
  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);
  const [inlineDraft, setInlineDraft] = useState('');
  const [isInlineSaving, setIsInlineSaving] = useState(false);
  const [reminderMemo, setReminderMemo] = useState<FridgeMemo | null>(null);
  const [customReminderAt, setCustomReminderAt] = useState('');

  function memoToneClass(memo: FridgeMemo, index: number) {
    const toneCount = 6;
    const seed = Array.from(memo.id || memo.text).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    let tone = seed % toneCount;
    if (index > 0) {
      const previous = memos[index - 1];
      const previousSeed = Array.from(previous.id || previous.text).reduce((sum, char) => sum + char.charCodeAt(0), 0);
      if (tone === previousSeed % toneCount) tone = (tone + 1) % toneCount;
    }
    return `memo-tone-${tone + 1}`;
  }

  function bindLongPress(memoId: string) {
    let timer: number | undefined;
    return {
      onPointerDown: () => {
        timer = window.setTimeout(() => onEnterSelectMode(memoId), 520);
      },
      onPointerUp: () => {
        if (timer) window.clearTimeout(timer);
      },
      onPointerLeave: () => {
        if (timer) window.clearTimeout(timer);
      },
      onContextMenu: (event: MouseEvent) => {
        event.preventDefault();
        onEnterSelectMode(memoId);
      },
    };
  }

  function startInlineEdit(memo: FridgeMemo) {
    setInlineEditingId(memo.id);
    setInlineDraft(memo.text);
  }

  function cancelInlineEdit() {
    setInlineEditingId(null);
    setInlineDraft('');
  }

  async function saveInlineEdit(memo: FridgeMemo) {
    try {
      setIsInlineSaving(true);
      const ok = await onUpdate(memo, inlineDraft);
      if (ok) cancelInlineEdit();
    } finally {
      setIsInlineSaving(false);
    }
  }

  function toLocalDateTimeValue(date: Date) {
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
  }

  function presetReminder(hour: number, dayOffset = 0) {
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    date.setHours(hour, 0, 0, 0);
    if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 1);
    return toLocalDateTimeValue(date);
  }

  function reminderBadge(memoId: string) {
    const reminder = reminders.find((item) => item.memo_id === memoId && item.status === 'pending');
    if (!reminder) return '';
    return new Intl.DateTimeFormat('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(reminder.remind_at));
  }

  async function saveReminder(remindAt: string) {
    if (!reminderMemo) return;
    const ok = await onScheduleReminder(reminderMemo, remindAt);
    if (ok) {
      setReminderMemo(null);
      setCustomReminderAt('');
    }
  }

  function openReminderSheet(memo: FridgeMemo) {
    setReminderMemo(memo);
    setCustomReminderAt(toLocalDateTimeValue(new Date()));
  }

  function closeReminderSheet() {
    setReminderMemo(null);
    setCustomReminderAt('');
  }

  return (
    <section className="memo-board">
      <div className="section-title">
        <div>
          <h2>메모</h2>
        </div>
        {!isSelectMode && (
          <div className="section-actions">
            {memos.length > 0 && (
              <button className="select-mode-button" type="button" onClick={() => onEnterSelectMode()}>
                선택
              </button>
            )}
          </div>
        )}
      </div>
      {isSelectMode && (
        <div className="memo-select-bar">
          <button type="button" onClick={onCancelSelect}>
            ← 취소
          </button>
          <strong>{selectedIds.length}개 선택됨</strong>
          <div className="memo-select-actions">
            <button type="button" onClick={selectedIds.length === memos.length ? onClearSelection : onSelectAll}>
              {selectedIds.length === memos.length ? '전체 해제' : '전체 선택'}
            </button>
            <button
              className="danger"
              type="button"
              onClick={onDeleteSelected}
              disabled={selectedIds.length === 0}
            >
              삭제
            </button>
          </div>
        </div>
      )}
      <form id="memo-form" className="memo-form" onSubmit={onSubmit}>
        {currentName && <p className="author-line">작성자 {currentName}</p>}
        <div className="memo-input-row">
          <input
            value={memoBody}
            onChange={(event) => setMemoBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onAdd();
              }
            }}
            maxLength={80}
            placeholder="메모 남기기"
          />
          <button className="memo-quick-add-button" type="submit" aria-label="메모 추가">
            <Plus size={18} strokeWidth={2.4} />
          </button>
        </div>
      </form>
      <div className="memo-notes">
        {memos.length === 0 && <EmptyNote text="아직 남긴 메모가 없어요" icon="/icons/dobob/svg_wrapped/empty/empty-memo.svg" />}
        {memos.map((memo, index) => {
          const isSelected = selectedIds.includes(memo.id);
          const isEditingInline = inlineEditingId === memo.id;
          const isRecent = isRecentMemo(memo.created_at);
          return (
          <article
            className={`memo-note ${memoToneClass(memo, index)} ${isSelectMode ? 'selectable' : ''} ${isSelected ? 'selected' : ''} ${isEditingInline ? 'editing' : ''} ${isRecent ? 'is-recent' : ''}`}
            key={memo.id}
            onClick={() => {
              if (isSelectMode) onToggleSelect(memo.id);
            }}
            {...(isEditingInline ? {} : bindLongPress(memo.id))}
          >
            {isSelectMode && (
              <span className="memo-checkbox" aria-hidden="true">
                {isSelected ? '✓' : ''}
              </span>
            )}
            {isEditingInline ? (
              <>
                <textarea
                  className="memo-inline-input"
                  value={inlineDraft}
                  onChange={(event) => setInlineDraft(event.target.value)}
                  maxLength={80}
                  autoFocus
                  onClick={(event) => event.stopPropagation()}
                />
                <div className="memo-inline-actions">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      saveInlineEdit(memo);
                    }}
                    disabled={isInlineSaving}
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      cancelInlineEdit();
                    }}
                    disabled={isInlineSaving}
                  >
                    취소
                  </button>
                </div>
              </>
            ) : (
              <>
                <p>{memo.text}</p>
                {reminderBadge(memo.id) && (
                  <span className="memo-reminder-badge">
                    <Bell size={12} />
                    {reminderBadge(memo.id)}
                  </span>
                )}
                <footer>
                  <span>{authorName(memo.author_id)}</span>
                  <time>{formatMemoTime(memo.created_at)}</time>
                </footer>
                {!isSelectMode && <div className="memo-actions">
                  <button
                    type="button"
                    aria-label="메모 수정"
                    title="수정"
                    onClick={(event) => {
                      event.stopPropagation();
                      startInlineEdit(memo);
                    }}
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="메모 삭제"
                    title="삭제"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(memo);
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                  <button
                    type="button"
                    aria-label="알림 설정"
                    title="알림 설정"
                    onClick={(event) => {
                      event.stopPropagation();
                      openReminderSheet(memo);
                    }}
                  >
                    <Bell size={14} />
                  </button>
                </div>}
              </>
            )}
          </article>
          );
        })}
      </div>
      {hasMore && (
        <button className="load-more-button" type="button" onClick={onLoadMore} disabled={isLoadingMore}>
          {isLoadingMore ? '불러오는 중' : '더보기'}
        </button>
      )}
      {reminderMemo && (
        <div className="reminder-sheet-backdrop" onClick={closeReminderSheet}>
          <div className="reminder-sheet" onClick={(event) => event.stopPropagation()}>
            <div>
              <p className="eyebrow">알림 설정</p>
              <h3>언제 알림을 보낼까요?</h3>
            </div>
            <p className="reminder-preview">{reminderMemo.text}</p>
            <div className="reminder-options">
              <button type="button" onClick={() => setCustomReminderAt(presetReminder(18))}>
                오늘 오후 6시
              </button>
              <button type="button" onClick={() => setCustomReminderAt(presetReminder(21))}>
                오늘 오후 9시
              </button>
              <button type="button" onClick={() => setCustomReminderAt(presetReminder(9, 1))}>
                내일 오전 9시
              </button>
            </div>
            <label className="reminder-custom">
              <span>직접 설정</span>
              <input
                type="datetime-local"
                value={customReminderAt}
                onChange={(event) => setCustomReminderAt(event.target.value)}
              />
            </label>
            <div className="reminder-sheet-actions">
              <button type="button" onClick={closeReminderSheet}>
                취소
              </button>
              <button type="button" onClick={() => customReminderAt && saveReminder(customReminderAt)} disabled={!customReminderAt}>
                알림 예약
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function MealForm({
  input,
  editing,
  templates,
  setInput,
  onSubmit,
  onTemplate,
  onAddTemplateToday,
  onDeleteTemplate,
  onSaveFavorite,
}: {
  input: MealInput;
  editing: MealMission | null;
  templates: MenuTemplate[];
  setInput: (input: MealInput) => void;
  onSubmit: (event: FormEvent) => void;
  onTemplate: (template: MenuTemplate) => void;
  onAddTemplateToday: (template: MenuTemplate) => void;
  onDeleteTemplate: (template: MenuTemplate) => void;
  onSaveFavorite: () => void;
}) {
  const suggestions = templates.filter((template) => template.menu_name.includes(input.menu_name)).slice(0, 4);
  const storageValues = input.items[0]?.storage_tags || [];
  const showMealSegmented = input.slot !== 'snack';
  const [isFavoriteSheetOpen, setIsFavoriteSheetOpen] = useState(false);

  function applyFavorite(template: MenuTemplate) {
    onTemplate(template);
    setIsFavoriteSheetOpen(false);
  }

  function setSimpleStorage(value: StorageTag) {
    const nextStorageValues = storageValues.includes(value)
      ? storageValues.filter((storage) => storage !== value)
      : [...storageValues, value];

    setInput({
      ...input,
      items: [{
        ...(input.items[0] || defaultItem),
        storage_tags: nextStorageValues,
      }],
    });
  }

  function updateItem(index: number, patch: Partial<MealMissionItemInput>) {
    const nextItems = input.items.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch } : item
    ));

    setInput({
      ...input,
      items: nextItems,
    });
  }

  function toggleItemValue<T extends StorageTag | PrepTag>(values: T[], value: T) {
    return values.includes(value)
      ? values.filter((current) => current !== value)
      : [...values, value];
  }

  function addItem() {
    setInput({
      ...input,
      items: [...input.items, { ...defaultItem }],
    });
  }

  function removeItem(index: number) {
    const nextItems = input.items.filter((_, itemIndex) => itemIndex !== index);
    setInput({
      ...input,
      items: nextItems.length > 0 ? nextItems : [{ ...defaultItem }],
    });
  }

  return (
    <section className="form-card paper-card">
      <div className="form-title">
        <ChefHat size={22} />
        <h2>{editing ? `${slotLabel[input.slot]} 수정` : `${slotLabel[input.slot]} 등록`}</h2>
      </div>
      <form onSubmit={onSubmit} className="meal-form">
        {isFavoriteSheetOpen && (
          <div className="favorite-sheet-backdrop" role="presentation" onClick={() => setIsFavoriteSheetOpen(false)}>
            <section className="favorite-sheet" role="dialog" aria-modal="true" aria-label="즐겨찾기" onClick={(event) => event.stopPropagation()}>
              <div className="favorite-sheet-header">
                <h3>즐겨찾기</h3>
                <button type="button" onClick={() => setIsFavoriteSheetOpen(false)} aria-label="닫기">×</button>
              </div>
              <div className="favorite-sheet-list">
                {templates.length === 0 && <p>아직 즐겨찾기한 식사가 없어요</p>}
                {templates.map((template) => (
                  <button type="button" key={template.id} onClick={() => applyFavorite(template)}>
                    <span>{template.menu_name}</span>
                    <small>{template.note || template.items.map((item) => item.name).filter(Boolean).join(', ') || '자주 쓰는 메뉴'}</small>
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
        {showMealSegmented && <div className="segmented">
          {(['breakfast', 'dinner'] as MealSlot[]).map((slot) => (
            <button
              type="button"
              key={slot}
              className={input.slot === slot ? 'active' : ''}
              onClick={() => setInput({ ...input, slot })}
            >
              {slotLabel[slot]}
            </button>
          ))}
        </div>}
        <label className="menu-name-field">
          <span className="field-label menu-label-row">
            <span>메뉴명 <b>*</b></span>
            <button className="favorite-mini-button" type="button" onClick={() => setIsFavoriteSheetOpen(true)} aria-label="즐겨찾기에서 불러오기" title="즐겨찾기에서 불러오기">
              <Star size={15} />
              불러오기
            </button>
          </span>
          <input id="meal-menu-name" value={input.menu_name} onChange={(event) => setInput({ ...input, menu_name: event.target.value })} placeholder="예: 카레 + 딸기" />
        </label>
        {input.menu_name && suggestions.length > 0 && (
          <div className="suggestions">
            {suggestions.map((template) => (
              <button type="button" key={template.id} onClick={() => onTemplate(template)}>
                {template.menu_name}
              </button>
            ))}
          </div>
        )}
        <OptionRow
          title="보관위치"
          groupName="storage-simple"
          options={storageOptions}
          values={storageValues}
          onToggle={setSimpleStorage}
        />
        <label>
          날짜
          <input value={input.meal_date} onChange={(event) => setInput({ ...input, meal_date: event.target.value })} type="date" />
        </label>
        <div className="form-title item-title">
          <h2>준비 항목</h2>
          <button className="small-button" type="button" onClick={addItem}>
            <Plus size={16} /> 항목 추가
          </button>
        </div>
        <div className="item-editor-list">
          {input.items.map((item, index) => (
            <article className="item-editor" key={index}>
              <div className="card-title">
                <span>항목 {index + 1}</span>
                <button className="ghost-button" type="button" onClick={() => removeItem(index)} aria-label="항목 삭제">
                  ×
                </button>
              </div>
              <label>
                재료/음식명
                <input value={item.name} onChange={(event) => updateItem(index, { name: event.target.value })} placeholder="예: 치즈" />
              </label>
              <label>
                어디 있음
                <input value={item.location} onChange={(event) => updateItem(index, { location: event.target.value })} placeholder="예: 냉장고 오른쪽 칸" />
              </label>
              <OptionRow
                title="보관 위치"
                groupName={`storage-${index}`}
                options={storageOptions}
                values={item.storage_tags}
                onToggle={(storage_tag) => updateItem(index, {
                  storage_tags: toggleItemValue(item.storage_tags, storage_tag),
                })}
              />
              <label>
                어떻게 준비
                <textarea value={item.prep} onChange={(event) => updateItem(index, { prep: event.target.value })} placeholder="예: 그냥 넣기" rows={2} />
              </label>
              <OptionRow
                title="조리 방법"
                groupName={`prep-${index}`}
                options={prepOptions}
                values={item.prep_tags}
                onToggle={(prep_tag) => updateItem(index, {
                  prep_tags: toggleItemValue(item.prep_tags, prep_tag),
                })}
              />
              <label>
                양
                <input value={item.amount} onChange={(event) => updateItem(index, { amount: event.target.value })} placeholder="예: 2장" />
              </label>
            </article>
          ))}
        </div>
        <label>
          메모
          <input value={input.note} onChange={(event) => setInput({ ...input, note: event.target.value })} placeholder="뜨거우면 식혀주기" />
        </label>
        <button className="primary-button" type="submit">
          <Save size={18} /> 등록
        </button>
        <button className="secondary-button" type="button" onClick={onSaveFavorite}>
          ☆ 즐겨찾기 저장
        </button>
      </form>
    </section>
  );
}

function OptionRow<T extends string>({
  title,
  groupName,
  options,
  values,
  onToggle,
}: {
  title: string;
  groupName: string;
  options: Array<{ value: T; label: string; icon: LucideIcon }>;
  values: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <div className="option-row">
      <span>{title}</span>
      <div>
        {options.map(({ value: optionValue, label, icon: Icon }) => (
          <button
            type="button"
            key={`${groupName}-${optionValue}`}
            className={values.includes(optionValue) ? 'active' : ''}
            aria-pressed={values.includes(optionValue)}
            onClick={(event) => {
              event.preventDefault();
              onToggle(optionValue);
            }}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ActionButton({
  children,
  type = 'button',
  onClick,
  ...props
}: {
  children: ReactNode;
  type?: 'button' | 'submit' | 'reset';
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>['onClick'];
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onClick' | 'className'>) {
  return (
    <button className="action-button" type={type} onClick={onClick} {...props}>
      {children}
    </button>
  );
}

function Tag({ values, type }: { values: StorageTag[] | PrepTag[]; type: 'storage' | 'prep' }) {
  const list = type === 'storage' ? storageOptions : prepOptions;
  return (
    <>
      {values.map((value) => {
        const item = list.find((option) => option.value === value);
        if (!item) return null;
        const Icon = item.icon;
        return (
          <span className="tag" key={`${type}-${value}`}>
            <Icon size={14} />
            {item.label}
          </span>
        );
      })}
    </>
  );
}

function TabButton({
  active,
  label,
  icon: Icon,
  onClick,
  featured = false,
}: {
  active: boolean;
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  featured?: boolean;
}) {
  return (
    <button className={`${active ? 'active' : ''}${featured ? ' home-tab' : ''}`} onClick={onClick} aria-label={label} title={label}>
      <Icon size={20} />
    </button>
  );
}

function EmptyNote({ text, icon }: { text: string; icon?: string }) {
  return (
    <div className="empty-note">
      {icon && <img src={icon} alt="" aria-hidden="true" />}
      <span>{text}</span>
    </div>
  );
}

function InlineEmptyNote({ text, icon }: { text: string; icon?: string }) {
  return (
    <p className="inline-empty-note">
      {icon && <img src={icon} alt="" aria-hidden="true" />}
      <span>{text}</span>
    </p>
  );
}

function formatMemoTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - targetDay.getTime()) / 86400000);
  const time = new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);

  if (diffDays === 0) return `오늘 ${time}`;
  if (diffDays === 1) return `어제 ${time}`;
  return `${date.getMonth() + 1}/${date.getDate()} ${time}`;
}

function isRecentMemo(value: string) {
  return Date.now() - new Date(value).getTime() <= 48 * 60 * 60 * 1000;
}

function toKoreanAuthError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('Invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않아요.';
  if (message.includes('Email not confirmed')) return 'Supabase Confirm email이 켜져 있어요. MVP에서는 OFF로 설정해주세요.';
  if (message.includes('User already registered')) return '이미 가입된 이메일이에요.';
  if (message.includes('Password should be')) return '비밀번호가 너무 짧아요. 더 긴 비밀번호를 입력해주세요.';
  if (message.includes('profiles')) return `프로필 생성에 실패했어요. ${message}`;
  return message || fallback;
}

export default App;
