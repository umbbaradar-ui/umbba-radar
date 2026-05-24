// ============================================
// 토스 콘솔 업로드용 썸네일 — 1932x828
// 좌: 마스코트 일러스트(PNG), 우: 앱명 + 슬로건 + 태그 칩
// 콘솔 "썸네일" 슬롯에 업로드
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
            "linear-gradient(135deg, #FFF5F8 0%, #FFE4ED 40%, #FFD0DE 100%)",
          position: "relative",
          display: "flex",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* 작은 별 데코 */}
        <div
          style={{
            position: "absolute",
            top: 110,
            left: 760,
            fontSize: 64,
            color: "#FBBF24",
            display: "flex",
          }}
        >
          ✦
        </div>
        <div
          style={{
            position: "absolute",
            top: 670,
            left: 80,
            fontSize: 42,
            color: "#FBBF24",
            display: "flex",
          }}
        >
          ✦
        </div>
        <div
          style={{
            position: "absolute",
            top: 660,
            left: 800,
            fontSize: 48,
            color: "#FB7185",
            display: "flex",
          }}
        >
          ♥
        </div>

        {/* === 좌측: 마스코트 일러스트 === */}
        <div
          style={{
            position: "absolute",
            top: 84,
            left: 84,
            width: 660,
            height: 660,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dataUrl}
            alt=""
            width={660}
            height={660}
            style={{ display: "flex" }}
          />
        </div>

        {/* === 우측: 텍스트 === */}
        <div
          style={{
            position: "absolute",
            top: 200,
            left: 870,
            display: "flex",
            flexDirection: "column",
            gap: 26,
          }}
        >
          {/* 앱 이름 */}
          <div
            style={{
              fontSize: 144,
              fontWeight: 900,
              color: "#1F1B16",
              letterSpacing: "-3px",
              lineHeight: 1,
              display: "flex",
            }}
          >
            엄빠레이더
          </div>

          {/* 슬로건 */}
          <div
            style={{
              fontSize: 54,
              fontWeight: 700,
              color: "#9B5B6E",
              letterSpacing: "-1.5px",
              lineHeight: 1.2,
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            엄빠 대신 매일 혜택 스캔 중
            <span style={{ color: "#FB7185", display: "flex" }}>♥</span>
          </div>

          {/* 태그 칩 */}
          <div
            style={{
              display: "flex",
              gap: 18,
              marginTop: 24,
            }}
          >
            <div
              style={{
                background: "white",
                color: "#9F1239",
                padding: "16px 32px",
                borderRadius: 999,
                fontSize: 36,
                fontWeight: 700,
                boxShadow: "0 4px 12px rgba(225, 29, 72, 0.12)",
                display: "flex",
              }}
            >
              #임신·출산
            </div>
            <div
              style={{
                background: "white",
                color: "#9F1239",
                padding: "16px 32px",
                borderRadius: 999,
                fontSize: 36,
                fontWeight: 700,
                boxShadow: "0 4px 12px rgba(225, 29, 72, 0.12)",
                display: "flex",
              }}
            >
              #체험단
            </div>
            <div
              style={{
                background: "white",
                color: "#9F1239",
                padding: "16px 32px",
                borderRadius: 999,
                fontSize: 36,
                fontWeight: 700,
                boxShadow: "0 4px 12px rgba(225, 29, 72, 0.12)",
                display: "flex",
              }}
            >
              #협찬
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 1932, height: 828 }
  );
}
