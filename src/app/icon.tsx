// ============================================
// 앱 아이콘 (PWA 512x512) — '엄빠레이더' 마스코트 (안테나 곰)
// 컨셉: 안테나 끝에 하트가 달린 조그마한 곰 — 부모님 대신 매일 혜택 스캔 중 ♥
// ============================================

import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
            top: 95,
            left: 252,
            width: 8,
            height: 50,
            background: "#9B6B7C",
            borderRadius: 4,
            display: "flex",
          }}
        />

        {/* 안테나 위 하트 */}
        <div
          style={{
            position: "absolute",
            top: 30,
            left: 218,
            fontSize: 88,
            color: "#FB7185",
            fontWeight: 900,
            lineHeight: 1,
            textShadow: "0 5px 14px rgba(225, 29, 72, 0.35)",
            display: "flex",
          }}
        >
          ♥
        </div>

        {/* 곰 귀 외곽 (좌) */}
        <div
          style={{
            position: "absolute",
            top: 138,
            left: 118,
            width: 110,
            height: 110,
            background: "#B89472",
            borderRadius: "50%",
            display: "flex",
          }}
        />
        {/* 곰 귀 외곽 (우) */}
        <div
          style={{
            position: "absolute",
            top: 138,
            left: 284,
            width: 110,
            height: 110,
            background: "#B89472",
            borderRadius: "50%",
            display: "flex",
          }}
        />

        {/* 곰 머리 (메인) */}
        <div
          style={{
            position: "absolute",
            top: 175,
            left: 106,
            width: 300,
            height: 270,
            background: "#E5C6A6",
            borderRadius: 150,
            boxShadow: "0 6px 16px rgba(155, 107, 124, 0.18)",
            display: "flex",
          }}
        />

        {/* 곰 귀 내부 (좌) — 머리 위에 그려야 함 */}
        <div
          style={{
            position: "absolute",
            top: 160,
            left: 140,
            width: 64,
            height: 64,
            background: "#F4B89A",
            borderRadius: "50%",
            display: "flex",
          }}
        />
        {/* 곰 귀 내부 (우) */}
        <div
          style={{
            position: "absolute",
            top: 160,
            left: 308,
            width: 64,
            height: 64,
            background: "#F4B89A",
            borderRadius: "50%",
            display: "flex",
          }}
        />

        {/* 주둥이 (밝은 영역) */}
        <div
          style={{
            position: "absolute",
            top: 310,
            left: 196,
            width: 120,
            height: 90,
            background: "#F8E4CC",
            borderRadius: 60,
            display: "flex",
          }}
        />

        {/* 볼터치 (좌) */}
        <div
          style={{
            position: "absolute",
            top: 310,
            left: 128,
            width: 38,
            height: 28,
            background: "#FFB1C8",
            borderRadius: 19,
            opacity: 0.75,
            display: "flex",
          }}
        />
        {/* 볼터치 (우) */}
        <div
          style={{
            position: "absolute",
            top: 310,
            left: 346,
            width: 38,
            height: 28,
            background: "#FFB1C8",
            borderRadius: 19,
            opacity: 0.75,
            display: "flex",
          }}
        />

        {/* 눈 (좌) */}
        <div
          style={{
            position: "absolute",
            top: 262,
            left: 178,
            width: 34,
            height: 34,
            background: "#2D1810",
            borderRadius: "50%",
            display: "flex",
          }}
        />
        {/* 눈 (우) */}
        <div
          style={{
            position: "absolute",
            top: 262,
            left: 300,
            width: 34,
            height: 34,
            background: "#2D1810",
            borderRadius: "50%",
            display: "flex",
          }}
        />

        {/* 눈동자 반사 (좌) */}
        <div
          style={{
            position: "absolute",
            top: 268,
            left: 196,
            width: 12,
            height: 12,
            background: "white",
            borderRadius: "50%",
            display: "flex",
          }}
        />
        {/* 눈동자 반사 (우) */}
        <div
          style={{
            position: "absolute",
            top: 268,
            left: 318,
            width: 12,
            height: 12,
            background: "white",
            borderRadius: "50%",
            display: "flex",
          }}
        />

        {/* 코 */}
        <div
          style={{
            position: "absolute",
            top: 326,
            left: 240,
            width: 32,
            height: 22,
            background: "#2D1810",
            borderRadius: 12,
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
