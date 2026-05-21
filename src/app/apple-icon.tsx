// ============================================
// Apple Touch Icon (iOS 홈 화면 추가 시 사용) — 180x180
// 동일 디자인을 180x180으로
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
          background: "linear-gradient(135deg, #FFF4E6 0%, #FFE4D6 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        <div
          style={{
            width: 148,
            height: 148,
            borderRadius: 148,
            border: "4px solid #FB7185",
            opacity: 0.25,
            position: "absolute",
            display: "flex",
          }}
        />
        <div
          style={{
            width: 102,
            height: 102,
            borderRadius: 102,
            border: "4px solid #FB7185",
            opacity: 0.5,
            position: "absolute",
            display: "flex",
          }}
        />
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 56,
            background: "#FB7185",
            position: "absolute",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 38,
            fontWeight: 900,
          }}
        >
          ♥
        </div>
      </div>
    ),
    { ...size }
  );
}
