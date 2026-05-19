# 도밥도밥 🍚

맞벌이 부모가 오늘 아기 식사 준비 미션을 빠르게 공유하는 모바일 우선 웹앱 MVP입니다. 식단표보다 냉장고 앞 포스트잇에 가까운 느낌으로, "어디 있는 뭘 어떻게 준비해?"를 바로 전달합니다.

## 기능

- 이메일/비밀번호 로그인 및 회원가입
- 오늘 아침/저녁 미션 카드
- 식단 등록/수정
- 먹였어요 체크
- 지난 식단 보기
- 자주 쓰는 메뉴 템플릿 저장 및 자동완성
- 냉장고 메모 보드: 짧은 메모, 작성자, 시간 표시
- 초대코드 기반 가족방 생성/참여
- 초대 링크 복사/공유 및 `/join/:inviteCode` 자동 참여
- 냉동고/냉장고/실온, 전자레인지/에프/그냥 주기 태그
- iPhone 홈 화면 추가용 Web App Manifest
- Supabase DB 기준 실제 데이터 저장

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
```

회원가입 화면에서 이메일, 비밀번호, 이름을 입력하면 Supabase Auth 계정이 생성되고, `handle_new_user` trigger와 앱의 `ensureProfile()` 보강 로직으로 `profiles` row가 자동 생성됩니다. `profiles.display_name`에는 회원가입 때 입력한 이름이 들어갑니다. 가입 직후에는 가족방이 없으므로 온보딩에서 새 가족방을 만들거나 초대 링크로 기존 가족방에 참여합니다.

## Supabase 연결

1. Supabase 프로젝트를 만듭니다.
2. Authentication에서 Email provider를 켜고, MVP 단계에서는 Confirm email을 OFF로 둡니다.
3. SQL Editor에서 [supabase/schema.sql](./supabase/schema.sql)을 실행합니다.
4. 회원가입 후 앱 온보딩에서 가족방을 만들면 `invite_code`가 자동 생성됩니다.
5. 다른 사용자는 초대 링크(`/join/:inviteCode`)를 열고 로그인한 뒤 자동으로 참여합니다.
6. Vercel 환경변수에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`를 등록합니다.

`profiles`는 수동으로 insert하지 않습니다. 특정 사용자 2명을 고정하지 않고, 가입한 사용자는 각자 가족방을 만들거나 초대 링크로 다른 가족방에 참여할 수 있습니다.

같은 `household_members.household_id`에 속한 계정만 미션, 냉장고 메모, 템플릿을 함께 볼 수 있습니다. 같은 가족방 안에서는 모든 멤버가 등록/수정/삭제할 수 있고, 화면에는 `profiles.display_name`이 작성자로 표시됩니다.

핵심 테이블:

- `profiles`: 사용자 이름
- `households`: 가족방, 이름, 초대코드
- `household_members`: 가족방 멤버십과 역할
- `meal_missions`, `fridge_memos`, `menu_templates`: 가족방별 데이터

## Vercel 배포

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Environment Variables: `.env.example`의 2개 값

## 구조

- [src/App.tsx](./src/App.tsx): 전체 UX와 화면 상태
- [src/lib/store.ts](./src/lib/store.ts): Supabase Auth/Profile/CRUD 어댑터
- [src/styles.css](./src/styles.css): 모바일 우선 냉장고 메모 보드 스타일
- [supabase/schema.sql](./supabase/schema.sql): 테이블, RLS 정책, 트리거
