import type { MetadataRoute } from "next";

// MetadataRoute.Manifest 타입엔 launch_handler / display_override / dir / screenshots
// 일부 신규 W3C 필드가 아직 없어서 캐스팅. 브라우저는 모두 지원.
type ExtendedManifest = MetadataRoute.Manifest & {
  dir?: "ltr" | "rtl" | "auto";
  display_override?: string[];
  launch_handler?: { client_mode?: string | string[] };
  screenshots?: Array<{
    src: string;
    sizes?: string;
    type?: string;
    form_factor?: "narrow" | "wide";
    label?: string;
  }>;
};

export default function manifest(): ExtendedManifest {
  return {
    // id: PWA 고유 식별자 (도메인 변경·www 추가에도 같은 앱으로 인식 → 중복 설치 방지)
    id: "/",
    name: "엄빠레이더",
    short_name: "엄빠레이더",
    description:
      "놓치는 혜택은 없게. 임신·출산·육아 협찬·체험단·후기를 한곳에 모은 큐레이션 앱.",
    start_url: "/",
    // scope: PWA 컨트롤 범위 (이 밖 URL은 외부 브라우저로 열림)
    scope: "/",
    // dir: 텍스트 방향 (한국어 좌→우)
    dir: "ltr",
    display: "standalone",
    // display_override: 데스크탑 PWA에서 window-controls-overlay 우선 시도, 안 되면 standalone fallback
    display_override: ["window-controls-overlay", "standalone"],
    // launch_handler: 앱 이미 열려 있으면 새 창 안 띄우고 기존 창에 navigate
    launch_handler: { client_mode: "navigate-existing" },
    background_color: "#FFF5F8",
    theme_color: "#FB7185",
    lang: "ko",
    orientation: "portrait",
    categories: ["lifestyle", "shopping", "parenting"],
    // PWA shortcuts: Android 홈 아이콘 길게 누르면 뜨는 빠른 메뉴
    // (iOS Safari는 미지원 — Android·일부 데스크탑만 적용)
    // 자주 가는 4곳 직행. 아이콘 미지정 시 OS가 앱 아이콘으로 fallback.
    shortcuts: [
      {
        name: "내 레이더 (관심·신청 카드)",
        short_name: "내 레이더",
        description: "관심·신청 표시한 카드 모아보기",
        url: "/my",
      },
      {
        name: "체험단만 보기",
        short_name: "체험단",
        description: "체험단·협찬 신청 가능 카드",
        url: "/?type=experience",
      },
      {
        name: "키즈모델만 보기",
        short_name: "키즈모델",
        description: "키즈모델·아동 모델 모집 카드",
        url: "/?type=kids_model",
      },
      {
        name: "혜택 제보하기",
        short_name: "제보",
        description: "발견한 협찬·체험단 알려주기",
        url: "/submit",
      },
    ],
    // PWA 아이콘 정책:
    // - any: Chrome/Edge 등이 그대로 사용 (둥근 모서리는 OS가 추가)
    // - maskable: Android 어댑티브 아이콘 (원/사각/물방울 등으로 잘림)
    //   → 중앙 80% safe area에 마스코트, 주변은 브랜드 핑크로 패딩
    // - apple-touch-icon은 별도 metadata 파일(src/app/apple-icon.png)이 처리
    // 아이콘 자산은 scripts/generate-pwa-icons.mjs로 일괄 생성
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // 안드로이드 Chrome 설치 모달 + Play Store 등록 시 사용
    // 사용자가 폰에서 직접 캡처해서 public/screenshots/ 에 업로드 필요
    //   - 사이즈: 1080x1920 (Android Phone portrait)
    //   - 캡처 가이드: PROJECT 루트 README 또는 OWNERSHIP.md 참조
    // 파일 없으면 PWABuilder가 경고 표시 (점수 영향) — 캡처 업로드 후 정상화
    screenshots: [
      {
        src: "/screenshots/mobile-home.png",
        sizes: "1080x1920",
        type: "image/png",
        form_factor: "narrow",
        label: "메인 — 오늘의 협찬·체험단 카드",
      },
      {
        src: "/screenshots/mobile-card.png",
        sizes: "1080x1920",
        type: "image/png",
        form_factor: "narrow",
        label: "카드 상세 — 신청 방법·마감일",
      },
      {
        src: "/screenshots/mobile-my.png",
        sizes: "1080x1920",
        type: "image/png",
        form_factor: "narrow",
        label: "내것 — 관심·신청 카드 모아보기",
      },
    ],
  };
}
