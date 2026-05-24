import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

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
  title: "엄빠레이더 — 놓치는 혜택은 없게",
  description:
    "임신·출산·육아 협찬과 체험단, 후기를 한곳에 모아 보여드려요. 부모님 대신 스캔 중.",
  applicationName: "엄빠레이더",
  keywords: ["육아", "협찬", "체험단", "리그램", "추첨", "무료체험", "육아 혜택"],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "엄빠레이더",
  },
  openGraph: {
    title: "엄빠레이더 — 놓치는 혜택은 없게",
    description:
      "임신·출산·육아 협찬과 체험단, 후기를 한곳에 모아 보여드려요.",
    url: "https://umbba-radar.com",
    siteName: "엄빠레이더",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "엄빠레이더 — 놓치는 혜택은 없게",
    description:
      "임신·출산·육아 협찬과 체험단, 후기를 한곳에 모아 보여드려요.",
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
      <body className="min-h-full flex flex-col bg-amber-50/40">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
