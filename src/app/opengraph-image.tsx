// ============================================
// Open Graph 이미지 — SNS 공유 시 미리보기
// 1200x630 (페이스북·트위터·카톡 공유 표준)
// ============================================

import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
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
        {/* 레이더 */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 280,
            height: 280,
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 280,
              height: 280,
              borderRadius: 280,
              border: "10px solid #FB7185",
              opacity: 0.2,
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 180,
              height: 180,
              borderRadius: 180,
              border: "10px solid #FB7185",
              opacity: 0.5,
              display: "flex",
            }}
          />
          <div
            style={{
              width: 90,
              height: 90,
              borderRadius: 90,
              background: "#FB7185",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 56,
              fontWeight: 900,
            }}
          >
            ♥
          </div>
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
            놓치는 혜택은 없게 · 부모님 대신 스캔 중
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
