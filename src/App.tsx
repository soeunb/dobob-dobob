import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import {
  Archive,
  Baby,
  Bell,
  CalendarDays,
  Check,
  ChefHat,
  Edit3,
  Flame,
  Heart,
  Home,
  Menu,
  Microwave,
  Milk,
  Plus,
  Refrigerator,
  Save,
  ShoppingCart,
  Snowflake,
  Star,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatKoreanDate, todayKey } from './lib/date';
import {
  fetchMeals,
  fetchMemos,
  fetchTemplates,
  getHouseholdId,
  getSession,
  saveMemo,
  saveTemplate,
  signIn,
  signOut,
  slotLabel,
  toggleFed,
  upsertMeal,
} from './lib/store';
import { isSupabaseConfigured } from './lib/supabase';
import { FridgeMemo, MealInput, MealMission, MealSlot, MenuTemplate, PrepTag, StorageTag } from './types';

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
  const [isAuthed, setIsAuthed] = useState(!isSupabaseConfigured);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [meals, setMeals] = useState<MealMission[]>([]);
  const [templates, setTemplates] = useState<MenuTemplate[]>([]);
  const [memos, setMemos] = useState<FridgeMemo[]>([]);
  const [activeTab, setActiveTab] = useState<'home' | 'write' | 'history' | 'templates'>('home');
  const [editing, setEditing] = useState<MealMission | null>(null);
  const [input, setInput] = useState<MealInput>(defaultInput);
  const [memoBody, setMemoBody] = useState('');
  const [memoAuthor, setMemoAuthor] = useState<'mom' | 'dad'>('mom');
  const [message, setMessage] = useState('');
  const householdId = getHouseholdId();

  async function refresh() {
    const [mealRows, templateRows, memoRows] = await Promise.all([
      fetchMeals(householdId),
      fetchTemplates(householdId),
      fetchMemos(householdId),
    ]);
    setMeals(mealRows);
    setTemplates(templateRows);
    setMemos(memoRows);
  }

  useEffect(() => {
    getSession().then((session) => {
      if (session || !isSupabaseConfigured) {
        setIsAuthed(true);
        refresh();
      }
    });
  }, []);

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

  const missionItems = useMemo(() => {
    const breakfast = todayMeals[0];
    const dinner = todayMeals[1];
    return [
      {
        id: 'rice',
        label: breakfast?.amount ? `냉동밥 ${breakfast.amount}` : '냉동밥 1팩',
        author: '아빠',
        done: true,
        tone: 'yellow',
      },
      {
        id: 'soup',
        label: breakfast?.prep?.includes('국') ? '국 데우기' : '소고기무국 데우기',
        author: '아빠',
        done: true,
        tone: 'green',
      },
      {
        id: 'cutlet',
        label: breakfast?.menu_name?.includes('돈까스') ? '돈까스 2개 에프' : '돈까스 2개 에프에 돌리기',
        author: '엄마',
        done: false,
        tone: 'plain',
      },
      {
        id: 'milk',
        label: dinner?.menu_name?.includes('딸기') ? '딸기 3개 씻기' : '우유 꺼내놓기',
        author: '엄마',
        done: false,
        tone: 'plain',
      },
    ];
  }, [todayMeals]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    try {
      await signIn(email, password);
      setIsAuthed(true);
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '로그인에 실패했어요.');
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await upsertMeal(householdId, input, editing?.id);
    if (input.menu_name.trim()) {
      const duplicated = templates.some((template) => template.menu_name === input.menu_name);
      if (!duplicated) await saveTemplate(householdId, input);
    }
    setEditing(null);
    setInput({ ...defaultInput, slot: input.slot });
    setActiveTab('home');
    await refresh();
  }

  async function handleMemoSubmit(event: FormEvent) {
    event.preventDefault();
    const body = memoBody.trim();
    if (!body) return;
    await saveMemo(householdId, {
      body,
      author_name: memoAuthor === 'mom' ? '엄마' : '아빠',
      author_emoji: memoAuthor === 'mom' ? '👩' : '👨',
    });
    setMemoBody('');
    await refresh();
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

  if (!isAuthed) {
    return (
      <main className="auth-shell">
        <section className="login-card paper-card">
          <div className="app-mark">🍚</div>
          <p className="eyebrow">shared fridge board</p>
          <h1 className="brand-title">도밥도밥</h1>
          <p className="login-copy">오늘 먹일 것, 어디 있는지, 어떻게 준비할지 한 장에 남겨요.</p>
          <form onSubmit={handleLogin} className="login-form">
            <label>
              이메일
              <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required />
            </label>
            <label>
              비밀번호
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required />
            </label>
            <button className="primary-button" type="submit">로그인</button>
          </form>
          {message && <p className="error-text">{message}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <button className="header-icon" aria-label="메뉴">
          <Menu size={22} />
        </button>
        <div className="brand-logo">
          <span className="brand-title">도밥도밥</span>
          <small>🍚</small>
        </div>
        <button
          className="header-icon notify-icon"
          aria-label="알림"
          onClick={async () => {
            await signOut();
            setIsAuthed(!isSupabaseConfigured);
          }}
        >
          <Bell size={21} />
          <em>2</em>
        </button>
      </header>

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
            {todayMeals.map((meal, index) => (
              <MealCard
                key={meal?.id || index}
                meal={meal}
                slot={index === 0 ? 'breakfast' : 'dinner'}
                onEdit={() => startEdit(meal || undefined, index === 0 ? 'breakfast' : 'dinner')}
                onToggle={async () => {
                  if (meal) {
                    await toggleFed(meal);
                    await refresh();
                  }
                }}
              />
            ))}
          </section>

          <FridgeMemoBoard
            memos={memos}
            memoBody={memoBody}
            memoAuthor={memoAuthor}
            setMemoBody={setMemoBody}
            setMemoAuthor={setMemoAuthor}
            onSubmit={handleMemoSubmit}
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
            <MealCard key={meal.id} meal={meal} slot={meal.slot} compact onEdit={() => startEdit(meal)} onToggle={async () => {
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
  onEdit,
  onToggle,
}: {
  meal?: MealMission;
  slot: MealSlot;
  compact?: boolean;
  onEdit: () => void;
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
        <button className="ghost-button" onClick={onEdit} aria-label="수정">
          <Edit3 size={17} />
        </button>
      </div>
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
  memoAuthor,
  setMemoBody,
  setMemoAuthor,
  onSubmit,
}: {
  memos: FridgeMemo[];
  memoBody: string;
  memoAuthor: 'mom' | 'dad';
  setMemoBody: (value: string) => void;
  setMemoAuthor: (value: 'mom' | 'dad') => void;
  onSubmit: (event: FormEvent) => void;
}) {
  return (
    <section className="memo-board">
      <div className="section-title">
        <div>
          <Heart size={17} />
          <h2>냉장고 메모</h2>
        </div>
        <button type="button">+ 쓰기</button>
      </div>
      <form id="memo-form" className="memo-form" onSubmit={onSubmit}>
        <div className="author-toggle">
          <button type="button" className={memoAuthor === 'mom' ? 'active' : ''} onClick={() => setMemoAuthor('mom')}>👩 엄마</button>
          <button type="button" className={memoAuthor === 'dad' ? 'active' : ''} onClick={() => setMemoAuthor('dad')}>👨 아빠</button>
        </div>
        <div className="memo-input-row">
          <input value={memoBody} onChange={(event) => setMemoBody(event.target.value)} maxLength={48} placeholder="우유 거의 없음" />
          <button type="submit" aria-label="메모 추가">
            <Plus size={18} />
          </button>
        </div>
      </form>
      <div className="memo-notes">
        {memos.map((memo, index) => (
          <article className={`memo-note note-${(index % 6) + 1}`} key={memo.id}>
            <span className="note-tape" />
            <p>{memo.body}</p>
            <footer>
              <span>{memo.author_emoji} {memo.author_name}</span>
              <time>{formatMemoTime(memo.created_at)}</time>
            </footer>
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

function formatHeroDate(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = new Intl.DateTimeFormat('ko-KR', { weekday: 'short' }).format(date);
  return `${month}월 ${day}일 (${weekday})`;
}

export default App;
