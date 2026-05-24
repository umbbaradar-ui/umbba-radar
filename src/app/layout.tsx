import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// Google Tag Manager — 환경변수 우선, 없으면 기본값 (배포 디폴트)
// dev 환경에선 자동 비활성 → 테스트 데이터가 GA4에 섞이지 않음
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID ?? "GTM-PR2K864P";
const GTM_ENABLED = Boolean(GTM_ID) && process.env.NODE_ENV === "production";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://umbba-radar.com"),
  title: {
    default: "엄빠레이더 — 엄빠 대신 매일 혜택 스캔 중 ♥",
    // 각 페이지 metadata.title 설정 시 "[페이지명] | 엄빠레이더" 형태로 자동 조합
    template: "%s",
  },
  description:
    "임신·출산·육아 협찬과 체험단, 후기를 한곳에 모아 보여드려요. 부모님 대신 스캔 중.",
  applicationName: "엄빠레이더",
  keywords: ["육아", "협찬", "체험단", "리그램", "추첨", "무료체험", "육아 혜택"],
  alternates: {
    canonical: "/",
  },
  // Search Console + Naver Search Advisor 소유권 인증
  // SSR로 HTML 첫 응답에 포함 → 검색엔진 봇이 안정적으로 인식
  verification: {
    google: "KEPWbz9jGjKitHbLa8h1gFBCQawUwi68YxacPE883rw",
    other: {
      "naver-site-verification": "4af6b3a074aa9d46366e74854048a4e2e20b7aa5",
    },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "엄빠레이더",
  },
  openGraph: {
    title: "엄빠레이더 — 엄빠 대신 매일 혜택 스캔 중 ♥",
    description:
      "임신·출산·육아 협찬과 체험단, 후기를 한곳에 모아 보여드려요.",
    url: "https://umbba-radar.com",
    siteName: "엄빠레이더",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "엄빠레이더 — 엄빠 대신 매일 혜택 스캔 중 ♥",
    description:
      "임신·출산·육아 협찬과 체험단, 후기를 한곳에 모아 보여드려요.",
  },
};

// JSON-LD Organization 구조화 데이터 — Google이 사이트 정체성 인식
const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "엄빠레이더",
  alternateName: "umbba-radar",
  url: "https://umbba-radar.com",
  logo: "https://umbba-radar.com/icons/icon-512.png",
  description:
    "임신·출산·육아 협찬·체험단·후기를 한곳에 모은 큐레이션 서비스",
  inLanguage: "ko-KR",
};

// JSON-LD WebSite 구조화 데이터 — sitelinks search box 후보
const WEBSITE_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "엄빠레이더",
  url: "https://umbba-radar.com",
  inLanguage: "ko-KR",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://umbba-radar.com/?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

export const viewport: Viewport = {
  themeColor: "#FB7185",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover", // iOS 노치 영역까지 사용 (Safe Area는 globals.css에서 처리)
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/* JSON-LD 구조화 데이터 — 검색엔진이 사이트 정체성/검색 박스 인식 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(ORGANIZATION_JSON_LD),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(WEBSITE_JSON_LD),
          }}
        />

        {/* Google Tag Manager — next/script로 SSR 안전하게 로드
            strategy="afterInteractive" = 페이지 인터랙티브 후 로드 (LCP 영향 X) */}
        {GTM_ENABLED && (
          <Script id="gtm-init" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`}
          </Script>
        )}
      </head>
      <body className="min-h-full flex flex-col bg-amber-50/40">
        {/* GTM noscript fallback — JS 차단 사용자도 페이지뷰 추적 */}
        {GTM_ENABLED && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
            />
          </noscript>
        )}
        {children}
        <Analytics />
      </body>
    </html>
  );
}
