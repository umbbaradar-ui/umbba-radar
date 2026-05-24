// ============================================
// 토스 콘솔 업로드용 앱 로고 — 600x600 (라이트 모드)
// 토스 콘솔 → 기본 정보 → "앱 로고" 슬롯에 업로드
// 브라우저에서 /toss-icon 방문 → 이미지 우클릭 → 저장
// ============================================

import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(135deg, #FFF5F8 0%, #FFE4ED 50%, #FFD0DE 100%)",
          position: "relative",
          display: "flex",
        }}
      >
        {/* 안테나 라인 */}
        <div
          style={{
            position: "absolute",
            top: 112,
            left: 296,
            width: 9,
            height: 58,
            background: "#9B6B7C",
            borderRadius: 4,
            display: "flex",
          }}
        />

        {/* 안테나 위 하트 */}
        <div
          style={{
            position: "absolute",
            top: 35,
            left: 255,
            fontSize: 104,
            color: "#FB7185",
            fontWeight: 900,
            lineHeight: 1,
            textShadow: "0 6px 16px rgba(225, 29, 72, 0.35)",
            display: "flex",
          }}
        >
          ♥
        </div>

        {/* 귀 외곽 */}
        <div
          style={{
            position: "absolute",
            top: 162,
            left: 138,
            width: 128,
            height: 128,
            background: "#B89472",
            borderRadius: "50%",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 162,
            left: 334,
            width: 128,
            height: 128,
            background: "#B89472",
            borderRadius: "50%",
            display: "flex",
          }}
        />

        {/* 머리 */}
        <div
          style={{
            position: "absolute",
            top: 205,
            left: 125,
            width: 350,
            height: 315,
            background: "#E5C6A6",
            borderRadius: 175,
            boxShadow: "0 8px 20px rgba(155, 107, 124, 0.18)",
            display: "flex",
          }}
        />

        {/* 귀 내부 */}
        <div
          style={{
            position: "absolute",
            top: 188,
            left: 164,
            width: 76,
            height: 76,
            background: "#F4B89A",
            borderRadius: "50%",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 188,
            left: 360,
            width: 76,
            height: 76,
            background: "#F4B89A",
            borderRadius: "50%",
            display: "flex",
          }}
        />

        {/* 주둥이 */}
        <div
          style={{
            position: "absolute",
            top: 362,
            left: 230,
            width: 140,
            height: 105,
            background: "#F8E4CC",
            borderRadius: 70,
            display: "flex",
          }}
        />

        {/* 볼터치 */}
        <div
          style={{
            position: "absolute",
            top: 362,
            left: 150,
            width: 45,
            height: 32,
            background: "#FFB1C8",
            borderRadius: 22,
            opacity: 0.75,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 362,
            left: 405,
            width: 45,
            height: 32,
            background: "#FFB1C8",
            borderRadius: 22,
            opacity: 0.75,
            display: "flex",
          }}
        />

        {/* 눈 */}
        <div
          style={{
            position: "absolute",
            top: 306,
            left: 208,
            width: 40,
            height: 40,
            background: "#2D1810",
            borderRadius: "50%",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 306,
            left: 352,
            width: 40,
            height: 40,
            background: "#2D1810",
            borderRadius: "50%",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 313,
            left: 229,
            width: 14,
            height: 14,
            background: "white",
            borderRadius: "50%",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 313,
            left: 373,
            width: 14,
            height: 14,
            background: "white",
            borderRadius: "50%",
            display: "flex",
          }}
        />

        {/* 코 */}
        <div
          style={{
            position: "absolute",
            top: 381,
            left: 282,
            width: 38,
            height: 26,
            background: "#2D1810",
            borderRadius: 14,
            display: "flex",
          }}
        />
      </div>
    ),
    { width: 600, height: 600 }
  );
}
