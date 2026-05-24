// ============================================
// 토스 콘솔 업로드용 앱 로고 — 600x600 (라이트)
// 마스코트 PNG(public/bear-mascot.png)를 그대로 600x600으로 서빙
// 콘솔 "앱 로고" 슬롯에 업로드
// ============================================

import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

// 파일시스템 접근 필요 → Node 런타임 (edge 사용 안 함)
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
          display: "flex",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUrl}
          alt=""
          width={600}
          height={600}
          style={{ display: "flex" }}
        />
      </div>
    ),
    { width: 600, height: 600 }
  );
}
