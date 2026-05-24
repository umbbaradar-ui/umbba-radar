// ============================================
// 토스 콘솔 업로드용 썸네일 — 1932x828 (가로 와이드 배너)
// 추천 미니앱 큰 카드에 노출되는 배너. 마스코트 + 슬로건 + 태그
// 브라우저에서 /toss-thumbnail 방문 → 이미지 저장 → 콘솔 업로드
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
            "linear-gradient(135deg, #FFF5F8 0%, #FFE4ED 40%, #FFD0DE 100%)",
          position: "relative",
          display: "flex",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* === 좌측: 마스코트 일러스트 === */}
        {/* 안테나 라인 */}
        <div
          style={{
            position: "absolute",
            top: 162,
            left: 408,
            width: 14,
            height: 90,
            background: "#9B6B7C",
            borderRadius: 7,
            display: "flex",
          }}
        />
        {/* 안테나 위 하트 */}
        <div
          style={{
            position: "absolute",
            top: 60,
            left: 350,
            fontSize: 150,
            color: "#FB7185",
            fontWeight: 900,
            lineHeight: 1,
            textShadow: "0 12px 28px rgba(225, 29, 72, 0.35)",
            display: "flex",
          }}
        >
          ♥
        </div>

        {/* 귀 외곽 */}
        <div
          style={{
            position: "absolute",
            top: 240,
            left: 188,
            width: 190,
            height: 190,
            background: "#B89472",
            borderRadius: "50%",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 240,
            left: 470,
            width: 190,
            height: 190,
            background: "#B89472",
            borderRadius: "50%",
            display: "flex",
          }}
        />

        {/* 머리 */}
        <div
          style={{
            position: "absolute",
            top: 305,
            left: 160,
            width: 520,
            height: 470,
            background: "#E5C6A6",
            borderRadius: 260,
            boxShadow: "0 16px 40px rgba(155, 107, 124, 0.25)",
            display: "flex",
          }}
        />

        {/* 귀 내부 */}
        <div
          style={{
            position: "absolute",
            top: 280,
            left: 232,
            width: 112,
            height: 112,
            background: "#F4B89A",
            borderRadius: "50%",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 280,
            left: 514,
            width: 112,
            height: 112,
            background: "#F4B89A",
            borderRadius: "50%",
            display: "flex",
          }}
        />

        {/* 주둥이 */}
        <div
          style={{
            position: "absolute",
            top: 545,
            left: 280,
            width: 210,
            height: 160,
            background: "#F8E4CC",
            borderRadius: 105,
            display: "flex",
          }}
        />

        {/* 볼터치 */}
        <div
          style={{
            position: "absolute",
            top: 545,
            left: 170,
            width: 65,
            height: 48,
            background: "#FFB1C8",
            borderRadius: 32,
            opacity: 0.78,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 545,
            left: 540,
            width: 65,
            height: 48,
            background: "#FFB1C8",
            borderRadius: 32,
            opacity: 0.78,
            display: "flex",
          }}
        />

        {/* 눈 */}
        <div
          style={{
            position: "absolute",
            top: 460,
            left: 252,
            width: 58,
            height: 58,
            background: "#2D1810",
            borderRadius: "50%",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 460,
            left: 470,
            width: 58,
            height: 58,
            background: "#2D1810",
            borderRadius: "50%",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 470,
            left: 282,
            width: 20,
            height: 20,
            background: "white",
            borderRadius: "50%",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 470,
            left: 500,
            width: 20,
            height: 20,
            background: "white",
            borderRadius: "50%",
            display: "flex",
          }}
        />

        {/* 코 */}
        <div
          style={{
            position: "absolute",
            top: 575,
            left: 363,
            width: 55,
            height: 38,
            background: "#2D1810",
            borderRadius: 20,
            display: "flex",
          }}
        />

        {/* 작은 별 데코 1 */}
        <div
          style={{
            position: "absolute",
            top: 130,
            left: 700,
            fontSize: 56,
            color: "#FBBF24",
            display: "flex",
          }}
        >
          ✦
        </div>
        {/* 작은 별 데코 2 */}
        <div
          style={{
            position: "absolute",
            top: 690,
            left: 105,
            fontSize: 38,
            color: "#FBBF24",
            display: "flex",
          }}
        >
          ✦
        </div>
        {/* 하트 데코 */}
        <div
          style={{
            position: "absolute",
            top: 640,
            left: 720,
            fontSize: 44,
            color: "#FB7185",
            display: "flex",
          }}
        >
          ♥
        </div>

        {/* === 우측: 텍스트 영역 === */}
        <div
          style={{
            position: "absolute",
            top: 200,
            left: 880,
            display: "flex",
            flexDirection: "column",
            gap: 28,
          }}
        >
          {/* 앱 이름 */}
          <div
            style={{
              fontSize: 140,
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
              fontSize: 56,
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

          {/* 태그 칩들 */}
          <div
            style={{
              display: "flex",
              gap: 18,
              marginTop: 16,
            }}
          >
            <div
              style={{
                background: "white",
                color: "#9F1239",
                padding: "16px 32px",
                borderRadius: 999,
                fontSize: 38,
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
                fontSize: 38,
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
                fontSize: 38,
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
