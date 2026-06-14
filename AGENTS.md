<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Module Ownership

이 프로젝트는 12개의 가상 담당자(virtual role)로 모듈이 분리되어 있어요.
작업 요청 처리 전에 **반드시 `OWNERSHIP.md`를 먼저 확인**하세요:

@OWNERSHIP.md

작업 흐름:
1. 사용자 요청 → 어느 담당자 영역인지 식별 (FRONT / CURATOR / AUTH / etc.)
2. 해당 담당자의 `Owns` 폴더만 우선 살펴봄 (다른 담당자 영역 침범은 명시 후)
3. 커밋 메시지에 담당자 prefix 사용: `feat(FRONT): ...`, `fix(AUTH): ...`

## 작업 원칙 (협업 메타)

- **부수 작업 선제 처리**: enum 추가 → AI 프롬프트도 같이, 타입 변경 → 사용처 일괄
- **사용자에게 물어볼 것**: 기존 데이터 마이그레이션, 정책 영향, 의견 갈리는 디자인
- **꼭 빌드 검증 후 커밋·푸시**: `npm run build` → 성공 → git
- **🔴 UI 검증은 항상 "모바일 우선"**: 화면(레이아웃·텍스트·버튼)을 바꾸는 작업은 **모든 검증의 1차로 모바일 뷰포트(375×812 등)에서 먼저 검수**한다. 주 사용자가 모바일이므로, 데스크탑만 보고 끝내지 말 것.
  - 체크리스트: ①텍스트 잘림/말줄임(`truncate`·`whitespace-nowrap` 주의) ②버튼·칩이 좁은 폭에서 겹치거나 줄 넘침 ③탭/터치 영역 ④한 줄 강제 요소가 긴 한글 문구에서 깨지지 않는지.
  - 방법: 프리뷰 `preview_resize`(mobile) 후 확인. 스크린샷이 막히면 DOM/computed style(`white-space`, `text-overflow`, 가로 오버플로)로라도 잘림 여부를 검증.
