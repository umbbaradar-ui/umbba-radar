// ============================================
// 토스 콘솔 업로드용 앱 로고 — 600x600 (다크모드)
// 마스코트 PNG를 어두운 배경 위에 합성
// 콘솔 "다크모드 앱 로고" 슬롯에 업로드 (선택 사항)
// ============================================

import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function GET() {
  const filePath = path.join(process.cwd(), "public", "bear-mascot.png");
  const buffer = await readFile(filePath);
  const base64 = buffer.toString("base64");
  const dataUrl = `data:image/png;base64,${base64}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "linear-gradient(135deg, #2D1B2E 0%, #3D2840 50%, #4A2F50 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUrl}
          alt=""
          width={552}
          height={552}
          style={{
            display: "flex",
            borderRadius: 100,
          }}
        />
      </div>
    ),
    { width: 600, height: 600 }
  );
}
