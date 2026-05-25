// ============================================
// Open Graph 이미지 — SNS 공유 시 미리보기
// 1200x630 (페이스북·트위터·카톡 공유 표준)
//
// 디자인: 레이더 원 3겹 + 가운데 곰돌이 마스코트
// public/bear-mascot.png 를 node:fs로 읽어 satori에 Buffer로 전달
// (fetch file:// 는 빌드 prerender 단계에서 "not implemented" — 무조건 fs 사용)
// runtime=nodejs 명시 (edge에선 fs 못 씀)
// ============================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// 모듈 로드 시 한 번만 읽고 data URL로 인코딩
// (satori가 Node Buffer를 직접 ArrayBuffer로 변환 못함 → data URL이 가장 안전)
const bearMascotDataUrl = `data:image/png;base64,${readFileSync(
  join(process.cwd(), "public", "bear-mascot.png")
).toString("base64")}`;

export default async function OpengraphImage() {

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #FFF4E6 0%, #FFE4D6 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 40,
          position: "relative",
        }}
      >
        {/* 레이더 — 핑크 원 3겹 + 가운데 곰돌이 마스코트 */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 320,
            height: 320,
          }}
        >
          {/* 외곽 레이더 원 (가장 옅음) */}
          <div
            style={{
              position: "absolute",
              width: 320,
              height: 320,
              borderRadius: 320,
              border: "10px solid #FB7185",
              opacity: 0.2,
              display: "flex",
            }}
          />
          {/* 중간 레이더 원 */}
          <div
            style={{
              position: "absolute",
              width: 220,
              height: 220,
              borderRadius: 220,
              border: "10px solid #FB7185",
              opacity: 0.45,
              display: "flex",
            }}
          />
          {/* 안쪽 솔리드 핑크 원 — 곰돌이 배경 */}
          <div
            style={{
              position: "absolute",
              width: 160,
              height: 160,
              borderRadius: 160,
              background: "#FFE4EC",
              display: "flex",
            }}
          />
          {/* 곰돌이 마스코트 (안테나에 하트 있는 브랜드 정체성) */}
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img
            src={bearMascotDataUrl}
            width={150}
            height={150}
            style={{
              objectFit: "contain",
              position: "relative",
            }}
          />
        </div>

        {/* 타이틀 */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              fontSize: 80,
              fontWeight: 900,
              color: "#0f172a",
              letterSpacing: -2,
            }}
          >
            엄빠레이더
          </div>
          <div
            style={{
              fontSize: 32,
              color: "#64748b",
              fontWeight: 600,
            }}
          >
            엄빠 대신 매일 혜택 스캔 중 ♥
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
