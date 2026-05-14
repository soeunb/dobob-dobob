# 도밥도밥 🍚

맞벌이 부모가 오늘 아기 식사 준비 미션을 빠르게 공유하는 모바일 우선 웹앱 MVP입니다. 식단표보다 냉장고 앞 포스트잇에 가까운 느낌으로, "어디 있는 뭘 어떻게 준비해?"를 바로 전달합니다.

## 기능

- 이메일/비밀번호 로그인
- 오늘 아침/저녁 미션 카드
- 식단 등록/수정
- 먹였어요 체크
- 지난 식단 보기
- 자주 쓰는 메뉴 템플릿 저장 및 자동완성
- 냉동고/냉장고/실온, 전자레인지/에프/그냥 주기 태그
- iPhone 홈 화면 추가용 Web App Manifest
- Supabase 미연결 시 더미 데이터로 로컬 미리보기

## 실행

```bash
npm install
npm run dev
```

이 환경에서 `npm`이 PATH에 없다면 Node 패키지 매니저를 설치하거나 PATH를 잡은 뒤 실행하세요.

## 환경변수

`.env.example`을 `.env`로 복사하고 값을 넣습니다.

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_DEMO_HOUSEHOLD_ID=your-household-uuid
```

`VITE_DEMO_HOUSEHOLD_ID`는 엄마/아빠 계정이 같은 데이터를 보게 하는 집 ID입니다. 실제 운영에서는 로그인한 유저의 `household_members`를 조회해 집 ID를 고르는 방식으로 확장하면 됩니다.

## Supabase 연결

1. Supabase 프로젝트를 만듭니다.
2. Authentication에서 Email provider를 켭니다.
3. SQL Editor에서 [supabase/schema.sql](./supabase/schema.sql)을 실행합니다.
4. `households`에 집 row를 하나 만들고, 엄마/아빠 유저를 Auth에서 생성합니다.
5. 두 유저의 `auth.users.id`를 `household_members`에 같은 `household_id`로 넣습니다.
6. Vercel 환경변수에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_DEMO_HOUSEHOLD_ID`를 등록합니다.

예시 seed:

```sql
insert into public.households (id, name)
values ('00000000-0000-0000-0000-000000000001', '도밥이네');

insert into public.household_members (household_id, user_id, role)
values
  ('00000000-0000-0000-0000-000000000001', '엄마-auth-user-id', 'mom'),
  ('00000000-0000-0000-0000-000000000001', '아빠-auth-user-id', 'dad');
```

## Vercel 배포

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variables: `.env.example`의 3개 값

## 구조

- [src/App.tsx](./src/App.tsx): 전체 UX와 화면 상태
- [src/lib/store.ts](./src/lib/store.ts): Supabase/로컬 더미 저장소 어댑터
- [src/lib/dummyData.ts](./src/lib/dummyData.ts): 더미 식단과 템플릿
- [src/styles.css](./src/styles.css): 모바일 우선 키치 메모장 스타일
- [supabase/schema.sql](./supabase/schema.sql): 테이블, RLS 정책, 트리거
