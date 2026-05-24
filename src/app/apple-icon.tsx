// ============================================
// Apple Touch Icon (iOS 홈 화면 추가 시 사용) — 180x180
// icon.tsx와 동일한 디자인을 180x180으로 비례 축소
// ============================================

import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        {/* 외곽 soft glow */}
        <div
          style={{
            width: 176,
            height: 176,
            borderRadius: 176,
            background:
              "radial-gradient(circle, rgba(251,113,133,0.12) 0%, rgba(251,113,133,0) 65%)",
            position: "absolute",
            display: "flex",
          }}
        />
        {/* 동심원 1 — 가장 옅게 */}
        <div
          style={{
            width: 156,
            height: 156,
            borderRadius: 156,
            border: "3px solid #FB7185",
            opacity: 0.15,
            position: "absolute",
            display: "flex",
          }}
        />
        {/* 동심원 2 */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: 120,
            border: "4px solid #FB7185",
            opacity: 0.3,
            position: "absolute",
            display: "flex",
          }}
        />
        {/* 동심원 3 — 강조색 */}
        <div
          style={{
            width: 86,
            height: 86,
            borderRadius: 86,
            border: "4px solid #F43F5E",
            opacity: 0.55,
            position: "absolute",
            display: "flex",
          }}
        />
        {/* 가운데 원 — 그라데이션 */}
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: 58,
            background: "linear-gradient(135deg, #FB7185 0%, #E11D48 100%)",
            boxShadow:
              "0 5px 12px rgba(225, 29, 72, 0.35), 0 2px 4px rgba(225, 29, 72, 0.25)",
            position: "absolute",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* 라이트 반사 */}
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 16,
              background:
                "radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 70%)",
              position: "absolute",
              top: 6,
              left: 10,
              display: "flex",
            }}
          />
          {/* 하트 */}
          <div
            style={{
              color: "white",
              fontSize: 36,
              fontWeight: 900,
              lineHeight: 1,
              display: "flex",
              textShadow: "0 1px 2px rgba(0,0,0,0.18)",
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
