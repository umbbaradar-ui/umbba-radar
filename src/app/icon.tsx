// ============================================
// 앱 아이콘 (PWA 512x512)
// 레이더 컨셉: 동심원 + 가운데 하트
// 본인 디자인 확정 시 SVG·PNG 파일로 교체 가능 (이 파일 삭제하고 같은 위치에 icon.png 두면 됨)
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
          background: "linear-gradient(135deg, #FFF4E6 0%, #FFE4D6 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {/* 바깥 동심원 */}
        <div
          style={{
            width: 420,
            height: 420,
            borderRadius: 420,
            border: "10px solid #FB7185",
            opacity: 0.25,
            position: "absolute",
            display: "flex",
          }}
        />
        {/* 중간 동심원 */}
        <div
          style={{
            width: 290,
            height: 290,
            borderRadius: 290,
            border: "10px solid #FB7185",
            opacity: 0.5,
            position: "absolute",
            display: "flex",
          }}
        />
        {/* 안쪽 채워진 원 */}
        <div
          style={{
            width: 160,
            height: 160,
            borderRadius: 160,
            background: "#FB7185",
            position: "absolute",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 110,
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
