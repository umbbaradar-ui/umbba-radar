import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "엄빠레이더",
    short_name: "엄빠레이더",
    description:
      "놓치는 혜택은 없게. 임신·출산·육아 협찬·체험단·후기를 한곳에 모은 큐레이션 앱.",
    start_url: "/",
    display: "standalone",
    background_color: "#FFF5F8",
    theme_color: "#FB7185",
    lang: "ko",
    orientation: "portrait",
    categories: ["lifestyle", "shopping", "parenting"],
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
  };
}
