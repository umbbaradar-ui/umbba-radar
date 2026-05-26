import type { MetadataRoute } from "next";

// MetadataRoute.Manifest 타입엔 launch_handler / display_override / dir / screenshots
// / share_target 등 신규 W3C 필드가 아직 없어서 캐스팅. 브라우저는 모두 지원.
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
  share_target?: {
    action: string;
    method?: "GET" | "POST";
    enctype?: string;
    params: {
      title?: string;
      text?: string;
      url?: string;
    };
  };
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
    // 운영 데이터 기반: 키즈모델 카드 비중 낮아서 홈화면으로 교체 (2026-05-26).
    shortcuts: [
      {
        name: "홈화면 (오늘의 카드)",
        short_name: "홈",
        description: "오늘 모은 협찬·체험단 카드",
        url: "/",
        icons: [{ src: "/icons/shortcut-home.png", sizes: "96x96", type: "image/png" }],
      },
      {
        name: "내 레이더 (관심·신청 카드)",
        short_name: "내 레이더",
        description: "관심·신청 표시한 카드 모아보기",
        url: "/my",
        icons: [{ src: "/icons/shortcut-my.png", sizes: "96x96", type: "image/png" }],
      },
      {
        name: "체험단만 보기",
        short_name: "체험단",
        description: "체험단·협찬 신청 가능 카드",
        url: "/?type=experience",
        icons: [{ src: "/icons/shortcut-experience.png", sizes: "96x96", type: "image/png" }],
      },
      {
        name: "혜택 제보하기",
        short_name: "제보",
        description: "발견한 협찬·체험단 알려주기",
        url: "/submit",
        icons: [{ src: "/icons/shortcut-submit.png", sizes: "96x96", type: "image/png" }],
      },
    ],
    // share_target: 다른 앱(인스타·카톡·갤러리)에서 "공유" → 엄빠레이더 PWA로 직행
    // GET 방식 — URL query string으로 전달되어 /submit 페이지가 받음
    // (POST + multipart도 가능하지만 GET이 가장 호환성 좋음 + 이미지 첨부는 1단계 X)
    // /submit/page.tsx가 shared_url/title/text searchParams로 폼 prefill 처리
    share_target: {
      action: "/submit",
      method: "GET",
      params: {
        title: "shared_title",
        text: "shared_text",
        url: "shared_url",
      },
    },
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
    // 안드로이드 Chrome 설치 모달 + Play Store 등록 시 사용 (form_factor: narrow)
    // 사용자 폰 캡처 원본 720×~1400 (안드로이드 일반 비율). PWABuilder/Play는 720+ OK.
    // 더 큰 1080×1920이 필요하면 사용자가 재캡처 후 동일 경로 덮어쓰기.
    screenshots: [
      {
        src: "/screenshots/mobile-home.jpg",
        sizes: "720x1403",
        type: "image/jpeg",
        form_factor: "narrow",
        label: "메인 — 오늘의 협찬·체험단 카드",
      },
      {
        src: "/screenshots/mobile-card.jpg",
        sizes: "720x1406",
        type: "image/jpeg",
        form_factor: "narrow",
        label: "카드 상세 — 신청 방법·마감일",
      },
      {
        src: "/screenshots/mobile-my.jpg",
        sizes: "720x1398",
        type: "image/jpeg",
        form_factor: "narrow",
        label: "내 레이더 — 관심·신청 카드 모아보기",
      },
    ],
  };
}
