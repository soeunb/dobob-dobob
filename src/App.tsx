import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Archive,
  Baby,
  Bell,
  Check,
  ChefHat,
  Edit3,
  Flame,
  Home,
  Menu,
  Microwave,
  Milk,
  Plus,
  Refrigerator,
  Save,
  Snowflake,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatKoreanDate, todayKey } from './lib/date';
import {
  createHousehold,
  deleteMeal,
  deleteMemo,
  fetchMeals,
  fetchMemos,
  fetchMyHouseholds,
  fetchProfiles,
  fetchTemplates,
  getCurrentProfile,
  getSession,
  joinHousehold,
  saveTemplate,
  signIn,
  signOut,
  signUp,
  slotLabel,
  toggleFed,
  upsertMeal,
  upsertMemo,
} from './lib/store';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import { FridgeMemo, Household, MealInput, MealMission, MealSlot, MenuTemplate, PrepTag, Profile, StorageTag } from './types';

const defaultInput: MealInput = {
  meal_date: todayKey(),
  slot: 'breakfast',
  menu_name: '',
  location: '',
  prep: '',
  amount: '',
  note: '',
  storage_tag: 'fridge',
  prep_tag: 'microwave',
};

const storageOptions: Array<{ value: StorageTag; label: string; icon: LucideIcon }> = [
  { value: 'freezer', label: '냉동고', icon: Snowflake },
  { value: 'fridge', label: '냉장고', icon: Refrigerator },
  { value: 'room', label: '실온', icon: Home },
];

const prepOptions: Array<{ value: PrepTag; label: string; icon: LucideIcon }> = [
  { value: 'microwave', label: '전자레인지', icon: Microwave },
  { value: 'airfryer', label: '에프', icon: Flame },
  { value: 'serve', label: '그냥 주기', icon: Baby },
];

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
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [currentHousehold, setCurrentHousehold] = useState<Household | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'write' | 'history' | 'templates'>('home');
  const [editing, setEditing] = useState<MealMission | null>(null);
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null);
  const [input, setInput] = useState<MealInput>(defaultInput);
  const [memoBody, setMemoBody] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [message, setMessage] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const householdId = currentHousehold?.id || '';

  async function refresh() {
    if (!householdId) return;
    try {
      const [mealRows, templateRows, memoRows, profileRows] = await Promise.all([
        fetchMeals(householdId),
        fetchTemplates(householdId),
        fetchMemos(householdId),
        fetchProfiles(householdId),
      ]);
      setMeals(mealRows);
      setTemplates(templateRows);
      setMemos(memoRows);
      setProfiles(profileRows);
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : '데이터를 불러오지 못했어요.');
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
    if (isAuthed && currentProfile && currentHousehold) refresh();
  }, [isAuthed, currentProfile?.id, currentHousehold?.id]);

  function authorName(authorId?: string | null) {
    if (!authorId) return '';
    return profiles.find((profile) => profile.id === authorId)?.display_name || '';
  }

  const todayMeals = useMemo(() => {
    const current = todayKey();
    return (['breakfast', 'dinner'] as MealSlot[]).map((slot) =>
      meals.find((meal) => meal.meal_date === current && meal.slot === slot),
    );
  }, [meals]);

  const history = useMemo(
    () => meals.filter((meal) => meal.meal_date !== todayKey()).slice(0, 12),
    [meals],
  );

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    try {
      await signIn(email, password);
      const profile = await getCurrentProfile();
      if (!profile?.display_name) {
        throw new Error('프로필 정보가 없어요. 회원가입을 다시 진행하거나 Supabase profiles row를 확인해주세요.');
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
      await signUp(email, password, name);
      const profile = await getCurrentProfile();
      if (!profile?.display_name) {
        setMessage('회원가입은 완료됐어요. 이메일 인증 후 로그인해주세요.');
        setAuthMode('login');
        return;
      }
      setCurrentProfile(profile);
      setCurrentHousehold(null);
      setIsAuthed(true);
      setMessage('');
    } catch (error) {
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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!currentProfile || !currentHousehold) return;
    await upsertMeal(householdId, input, currentProfile.id, editing?.id);
    if (input.menu_name.trim()) {
      const duplicated = templates.some((template) => template.menu_name === input.menu_name);
      if (!duplicated) await saveTemplate(householdId, input, currentProfile.id);
    }
    setEditing(null);
    setInput({ ...defaultInput, slot: input.slot });
    setActiveTab('home');
    await refresh();
  }

  async function handleAddMemo() {
    const body = memoBody.trim();
    if (!body) return;

    if (!currentProfile || !currentHousehold) return;
    await upsertMemo(householdId, { text: body }, currentProfile.id, editingMemoId || undefined);
    setMemoBody('');
    setEditingMemoId(null);
    await refresh();
  }

  function handleMemoSubmit(event: FormEvent) {
    event.preventDefault();
    handleAddMemo();
  }

  async function handleDeleteMeal(meal: MealMission) {
    if (!confirm('이 미션을 삭제할까요?')) return;
    await deleteMeal(meal.id);
    if (editing?.id === meal.id) {
      setEditing(null);
      setInput({ ...defaultInput });
    }
    await refresh();
  }

  async function handleDeleteMemo(memo: FridgeMemo) {
    if (!confirm('이 메모를 삭제할까요?')) return;
    await deleteMemo(memo.id);
    if (editingMemoId === memo.id) {
      setEditingMemoId(null);
      setMemoBody('');
    }
    await refresh();
  }

  function startEditMemo(memo: FridgeMemo) {
    setEditingMemoId(memo.id);
    setMemoBody(memo.text);
  }

  function startEdit(meal?: MealMission, slot?: MealSlot) {
    if (meal) {
      setEditing(meal);
      setInput({
        meal_date: meal.meal_date,
        slot: meal.slot,
        menu_name: meal.menu_name,
        location: meal.location,
        prep: meal.prep,
        amount: meal.amount,
        note: meal.note,
        storage_tag: meal.storage_tag,
        prep_tag: meal.prep_tag,
      });
    } else {
      setEditing(null);
      setInput({ ...defaultInput, meal_date: todayKey(), slot: slot || 'breakfast' });
    }
    setActiveTab('write');
  }

  function applyTemplate(template: MenuTemplate) {
    setInput({
      ...input,
      menu_name: template.menu_name,
      location: template.location,
      prep: template.prep,
      amount: template.amount,
      note: template.note,
      storage_tag: template.storage_tag,
      prep_tag: template.prep_tag,
    });
    setActiveTab('write');
  }

  if (isAuthLoading) {
    return (
      <main className="auth-shell">
        <section className="login-card paper-card">
          <div className="app-mark">🍚</div>
          <h1 className="brand-title">도밥도밥</h1>
          <p className="login-copy">로그인 상태를 확인하고 있어요.</p>
        </section>
      </main>
    );
  }

  if (!isAuthed) {
    return (
      <main className="auth-shell">
        <section className="login-card paper-card">
          <div className="app-mark">🍚</div>
          <p className="eyebrow">shared fridge board</p>
          <h1 className="brand-title">{authMode === 'login' ? '도밥도밥' : '회원가입'}</h1>
          <p className="login-copy">
            {authMode === 'login'
              ? '오늘 먹일 것, 어디 있는지, 어떻게 준비할지 한 장에 남겨요.'
              : '이름과 계정을 만들고 같은 집 냉장고 보드를 함께 써요.'}
          </p>
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
          <div className="app-mark">🍚</div>
          <p className="eyebrow">family board setup</p>
          <h1 className="brand-title">가족방 시작하기</h1>
          <p className="login-copy">
            {currentProfile?.display_name}님, 함께 쓸 냉장고 보드를 만들거나 초대코드로 참여해주세요.
          </p>

          <div className="onboarding-grid">
            <form className="login-form onboarding-card" onSubmit={handleCreateHousehold}>
              <h2>가족방 만들기</h2>
              <p>우리 집만의 미션과 메모가 따로 저장돼요.</p>
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
          <small>🍚</small>
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
          <em>2</em>
        </button>
        {isNotificationOpen && (
          <div className="notification-menu">
            아직 새 알림이 없어요
          </div>
        )}
      </header>

      <section className="main-content">
        {activeTab === 'home' && (
          <>
          <section className="mission-head">
            <div>
              <p>{formatKoreanDate(todayKey())}</p>
              <h2>오늘의 미션</h2>
            </div>
            <button className="small-button" onClick={() => startEdit()}>
              <Plus size={17} /> 등록
            </button>
          </section>

          <section className="today-grid">
            {todayMeals.some(Boolean) ? (
              todayMeals.map((meal, index) => (
                meal && (
                  <MealCard
                    key={meal.id}
                    meal={meal}
                    slot={index === 0 ? 'breakfast' : 'dinner'}
                    authorName={authorName(meal.author_id)}
                    onEdit={() => startEdit(meal, index === 0 ? 'breakfast' : 'dinner')}
                    onDelete={() => handleDeleteMeal(meal)}
                    onToggle={async () => {
                      await toggleFed(meal);
                      await refresh();
                    }}
                  />
                )
              ))
            ) : (
              <EmptyNote text="아직 등록된 미션이 없어요" />
            )}
          </section>

          <FridgeMemoBoard
            memos={memos}
            memoBody={memoBody}
            setMemoBody={setMemoBody}
            onSubmit={handleMemoSubmit}
            onAdd={handleAddMemo}
            authorName={authorName}
            currentName={currentProfile?.display_name || ''}
            onEdit={startEditMemo}
            onDelete={handleDeleteMemo}
            editingMemoId={editingMemoId}
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
          />
        )}

        {activeTab === 'history' && (
          <section className="stack">
            {history.length === 0 && <EmptyNote text="아직 지난 식단이 없어요." />}
            {history.map((meal) => (
              <MealCard key={meal.id} meal={meal} slot={meal.slot} compact authorName={authorName(meal.author_id)} onEdit={() => startEdit(meal)} onDelete={() => handleDeleteMeal(meal)} onToggle={async () => {
                await toggleFed(meal);
                await refresh();
              }} />
            ))}
          </section>
        )}

        {activeTab === 'templates' && (
          <section className="stack">
            {templates.map((template) => (
              <button key={template.id} className="template-card" onClick={() => applyTemplate(template)}>
                <Milk size={19} />
                <span>{template.menu_name}</span>
                <small>{template.location}</small>
              </button>
            ))}
          </section>
        )}
      </section>

      <nav className="bottom-nav" aria-label="주 메뉴">
        <TabButton active={activeTab === 'home'} label="오늘" icon={Home} onClick={() => setActiveTab('home')} />
        <TabButton active={activeTab === 'write'} label="등록" icon={Edit3} onClick={() => startEdit()} />
        <TabButton active={activeTab === 'history'} label="지난" icon={Archive} onClick={() => setActiveTab('history')} />
        <TabButton active={activeTab === 'templates'} label="템플릿" icon={ChefHat} onClick={() => setActiveTab('templates')} />
      </nav>
    </main>
  );
}

function MealCard({
  meal,
  slot,
  compact,
  authorName,
  onEdit,
  onDelete,
  onToggle,
}: {
  meal?: MealMission;
  slot: MealSlot;
  compact?: boolean;
  authorName?: string;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}) {
  if (!meal) {
    return (
      <article className="meal-card empty-card">
        <div className="card-title">
          <span>{slotLabel[slot]}</span>
          <button className="ghost-button" onClick={onEdit} aria-label="미션 쓰기">
            <Plus size={17} />
          </button>
        </div>
        <p>아직 적힌 미션이 없어요.</p>
      </article>
    );
  }

  return (
    <article className={`meal-card ${meal.is_fed ? 'is-done' : ''} ${compact ? 'compact' : ''}`}>
      <div className="card-title">
        <span>{slotLabel[slot]}</span>
        <div className="card-actions">
          <button className="ghost-button" onClick={onEdit} aria-label="수정">
            <Edit3 size={17} />
          </button>
          <button className="ghost-button" onClick={onDelete} aria-label="삭제">
            ×
          </button>
        </div>
      </div>
      {authorName && <p className="author-line">작성자 {authorName}</p>}
      <h3>{meal.menu_name}</h3>
      <div className="chip-row">
        <Tag value={meal.storage_tag} type="storage" />
        <Tag value={meal.prep_tag} type="prep" />
      </div>
      <dl className="mission-list">
        <div><dt>어디 있음</dt><dd>{meal.location}</dd></div>
        <div><dt>어떻게 준비</dt><dd>{meal.prep}</dd></div>
        <div><dt>양</dt><dd>{meal.amount || '평소만큼'}</dd></div>
        {meal.note && <div><dt>메모</dt><dd>{meal.note}</dd></div>}
      </dl>
      <button className={`fed-button ${meal.is_fed ? 'checked' : ''}`} onClick={onToggle}>
        <Check size={18} />
        {meal.is_fed ? '먹였어요' : '먹였어요 체크'}
      </button>
    </article>
  );
}

function FridgeMemoBoard({
  memos,
  memoBody,
  setMemoBody,
  onSubmit,
  onAdd,
  authorName,
  currentName,
  onEdit,
  onDelete,
  editingMemoId,
}: {
  memos: FridgeMemo[];
  memoBody: string;
  setMemoBody: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  onAdd: () => void;
  authorName: (authorId?: string | null) => string;
  currentName: string;
  onEdit: (memo: FridgeMemo) => void;
  onDelete: (memo: FridgeMemo) => void;
  editingMemoId: string | null;
}) {
  return (
    <section className="memo-board">
      <div className="section-title">
        <div>
          <h2>냉장고 메모</h2>
        </div>
        <button type="button">+ 쓰기</button>
      </div>
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
          <button type="button" onClick={onAdd} aria-label="메모 추가">
            {editingMemoId ? '수정' : '+'}
          </button>
        </div>
      </form>
      <div className="memo-notes">
        {memos.length === 0 && <EmptyNote text="아직 남긴 메모가 없어요" />}
        {memos.map((memo) => (
          <article className="memo-note" key={memo.id}>
            <span className="note-tape" />
            <p>{memo.text}</p>
            <footer>
              <span>{authorName(memo.author_id)}</span>
              <time>{formatMemoTime(memo.created_at)}</time>
            </footer>
            <div className="memo-actions">
              <button type="button" onClick={() => onEdit(memo)}>수정</button>
              <button type="button" onClick={() => onDelete(memo)}>삭제</button>
            </div>
          </article>
        ))}
      </div>
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
}: {
  input: MealInput;
  editing: MealMission | null;
  templates: MenuTemplate[];
  setInput: (input: MealInput) => void;
  onSubmit: (event: FormEvent) => void;
  onTemplate: (template: MenuTemplate) => void;
}) {
  const suggestions = templates.filter((template) => template.menu_name.includes(input.menu_name)).slice(0, 4);

  return (
    <section className="form-card paper-card">
      <div className="form-title">
        <ChefHat size={22} />
        <h2>{editing ? '미션 수정' : '빠른 미션 등록'}</h2>
      </div>
      <form onSubmit={onSubmit} className="meal-form">
        <div className="segmented">
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
        </div>
        <label>
          메뉴명
          <input value={input.menu_name} onChange={(event) => setInput({ ...input, menu_name: event.target.value })} placeholder="예: 카레 + 딸기" required />
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
        <label>
          어디 있음
          <input value={input.location} onChange={(event) => setInput({ ...input, location: event.target.value })} placeholder="냉장고 왼쪽 국통" />
        </label>
        <label>
          어떻게 준비
          <textarea value={input.prep} onChange={(event) => setInput({ ...input, prep: event.target.value })} placeholder="에프 180도 8분" rows={3} />
        </label>
        <div className="double">
          <label>
            양
            <input value={input.amount} onChange={(event) => setInput({ ...input, amount: event.target.value })} placeholder="2개" />
          </label>
          <label>
            날짜
            <input value={input.meal_date} onChange={(event) => setInput({ ...input, meal_date: event.target.value })} type="date" />
          </label>
        </div>
        <label>
          메모
          <input value={input.note} onChange={(event) => setInput({ ...input, note: event.target.value })} placeholder="뜨거우면 식혀주기" />
        </label>
        <OptionRow title="보관" options={storageOptions} value={input.storage_tag} onChange={(storage_tag) => setInput({ ...input, storage_tag })} />
        <OptionRow title="조리" options={prepOptions} value={input.prep_tag} onChange={(prep_tag) => setInput({ ...input, prep_tag })} />
        <button className="primary-button" type="submit">
          <Save size={18} /> 저장하고 공유
        </button>
      </form>
    </section>
  );
}

function OptionRow<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: Array<{ value: T; label: string; icon: LucideIcon }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="option-row">
      <span>{title}</span>
      <div>
        {options.map(({ value: optionValue, label, icon: Icon }) => (
          <button
            type="button"
            key={optionValue}
            className={value === optionValue ? 'active' : ''}
            onClick={() => onChange(optionValue)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Tag({ value, type }: { value: StorageTag | PrepTag; type: 'storage' | 'prep' }) {
  const list = type === 'storage' ? storageOptions : prepOptions;
  const item = list.find((option) => option.value === value)!;
  const Icon = item.icon;
  return (
    <span className="tag">
      <Icon size={14} />
      {item.label}
    </span>
  );
}

function TabButton({ active, label, icon: Icon, onClick }: { active: boolean; label: string; icon: LucideIcon; onClick: () => void }) {
  return (
    <button className={active ? 'active' : ''} onClick={onClick}>
      <Icon size={20} />
      <span>{label}</span>
    </button>
  );
}

function EmptyNote({ text }: { text: string }) {
  return <div className="empty-note">{text}</div>;
}

function formatMemoTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function toKoreanAuthError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('Invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않아요.';
  if (message.includes('Email not confirmed')) return '이메일 인증 후 로그인해주세요.';
  if (message.includes('User already registered')) return '이미 가입된 이메일이에요.';
  if (message.includes('Password should be')) return '비밀번호가 너무 짧아요. 더 긴 비밀번호를 입력해주세요.';
  if (message.includes('profiles')) return `프로필 생성에 실패했어요. ${message}`;
  return message || fallback;
}

export default App;
