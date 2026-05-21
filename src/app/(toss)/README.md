# (toss) 라우트 그룹 — 사용 보류

## 결정 (2026-05-22)

토스 앱인토스 SDK(`@apps-in-toss/web-framework`)는 **Vite 전용**으로 확인됐다. Next.js와는 같은 프로젝트에서 공존이 어렵다.

따라서 원래 계획했던 `app/(web)` + `app/(toss)` 듀얼 라우트 그룹 구조는 사용하지 않는다.

## 대신 가는 길

토스 미니앱은 **별도 Vite 프로젝트**로 만든다:

```
앱프로젝트/
├── umbba-radar/             ← 현재 Next.js 웹앱 (이 폴더)
└── umbba-radar-toss/        ← 향후 Vite + @apps-in-toss/web-framework (별도)
```

두 앱이 공유하는 것:
- **Supabase 백엔드** — 같은 DB, 같은 RLS
- 동일한 타입 정의 (`Post`, 카테고리, 라벨)
- 동일한 시각 디자인 토큰 (Tailwind config 복사)

공유 방법은 두 가지 옵션:
1. **수동 복사** — 단순. 변경 시 두 곳에 손대야 함 (Phase 1.5)
2. **pnpm workspace 모노레포** — `packages/shared/` 에서 타입·서비스 공유 (Phase 2~)

## Phase 1.5에서 할 일 (Toss 진입 시점에)

```bash
# 별도 디렉터리에서
npx create-ait-app umbba-radar-toss
cd umbba-radar-toss
npm install @supabase/supabase-js
```

`granite.config.ts` 설정:
```ts
export default defineConfig({
  appName: 'umbba-radar',
  brand: {
    displayName: '엄빠레이더',
    primaryColor: '#FB7185',
    icon: '...',
  },
  web: { /* Vite dev server 옵션 */ },
  permissions: [],
});
```

그 다음 우리 `umbba-radar/src/modules/content/` 의 service·repository·UI를 복사해서 Vite 환경에서 작동하도록 살짝 조정.

## 이 폴더는?

이 `(toss)/` 폴더는 빈 채로 둔다. Next.js는 빈 라우트 그룹을 무시한다. 향후 폴더 자체를 삭제할 수도 있지만, ARCHITECTURE.md 의 의도를 보존하기 위해 표식으로 남겨둠.
