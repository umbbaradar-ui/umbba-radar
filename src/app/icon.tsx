// ============================================
// 앱 아이콘 (PWA 512x512)
// 레이더 컨셉: 다중 동심원 + 가운데 하트
// 깊이감을 위해 그라데이션 배경 + 외곽 glow + 그림자 + 하이라이트
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
            "linear-gradient(135deg, #FFF7ED 0%, #FFEDD5 45%, #FECDD3 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* 외곽 soft glow — 부드러운 빛 번짐 */}
        <div
          style={{
            width: 500,
            height: 500,
            borderRadius: 500,
            background:
              "radial-gradient(circle, rgba(251,113,133,0.12) 0%, rgba(251,113,133,0) 65%)",
            position: "absolute",
            display: "flex",
          }}
        />
        {/* 가장 바깥 동심원 — 매우 옅게 */}
        <div
          style={{
            width: 440,
            height: 440,
            borderRadius: 440,
            border: "8px solid #FB7185",
            opacity: 0.15,
            position: "absolute",
            display: "flex",
          }}
        />
        {/* 두 번째 동심원 */}
        <div
          style={{
            width: 340,
            height: 340,
            borderRadius: 340,
            border: "10px solid #FB7185",
            opacity: 0.3,
            position: "absolute",
            display: "flex",
          }}
        />
        {/* 세 번째 동심원 — 강조색 (rose-600) */}
        <div
          style={{
            width: 240,
            height: 240,
            borderRadius: 240,
            border: "12px solid #F43F5E",
            opacity: 0.55,
            position: "absolute",
            display: "flex",
          }}
        />
        {/* 가운데 채워진 원 — 그라데이션 + 그림자 */}
        <div
          style={{
            width: 160,
            height: 160,
            borderRadius: 160,
            background: "linear-gradient(135deg, #FB7185 0%, #E11D48 100%)",
            boxShadow:
              "0 14px 32px rgba(225, 29, 72, 0.35), 0 4px 12px rgba(225, 29, 72, 0.25)",
            position: "absolute",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* 좌측 상단 라이트 반사 */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 44,
              background:
                "radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%)",
              position: "absolute",
              top: 16,
              left: 26,
              display: "flex",
            }}
          />
          {/* 하트 */}
          <div
            style={{
              color: "white",
              fontSize: 100,
              fontWeight: 900,
              lineHeight: 1,
              display: "flex",
              textShadow: "0 2px 4px rgba(0,0,0,0.18)",
            }}
          >
            ♥
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
