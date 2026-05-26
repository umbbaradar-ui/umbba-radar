// ============================================
// 카드 상세 OG 이미지 — 카톡·페북·트위터 공유 시 카드별 미리보기
// 1200x630 (소셜 표준)
// 좌측: 썸네일(없으면 곰돌이 마스코트 fallback) / 우측: 브랜드·제목·D-day + 곰돌이 워터마크
//
// 곰돌이 PNG 임베드 (루트 OG와 동일 패턴: node:fs + base64 data URL).
// satori는 Buffer 직접 못 받음 → data URL이 가장 안전.
// runtime=nodejs (edge에선 fs 사용 불가).
// ============================================

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getPost } from "@/modules/content/service";
import { calcDDay } from "@/shared/utils/dday";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "엄빠레이더 카드 상세";

// 60초마다 재생성 (카드 정보 변경 시 OG 이미지도 자동 갱신)
export const revalidate = 60;

// 모듈 로드 시 한 번만 읽고 base64 data URL로 인코딩 (모든 카드 OG가 공유)
const bearMascotDataUrl = `data:image/png;base64,${readFileSync(
  join(process.cwd(), "public", "bear-mascot.png")
).toString("base64")}`;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PostOgImage({ params }: Props) {
  const { id } = await params;
  const post = await getPost(id);

  // 카드 없으면 폴백 (default OG와 동일 톤)
  if (!post) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 24,
            background: "#FFF5F8",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img src={bearMascotDataUrl} width={180} height={180} />
          <div style={{ fontSize: 48, color: "#0f172a", fontWeight: 800 }}>
            엄빠레이더
          </div>
        </div>
      ),
      size
    );
  }

  const dday = calcDDay(post.deadline);
  const hasThumb = Boolean(post.thumbnail_url);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#FFF5F8",
        }}
      >
        {/* 좌측 — 썸네일 (없으면 핑크 그라데이션) */}
        <div
          style={{
            width: 600,
            height: 630,
            display: "flex",
            background: "linear-gradient(135deg, #FBCFE8 0%, #FED7AA 100%)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {hasThumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.thumbnail_url!}
              alt=""
              width={600}
              height={630}
              style={{
                width: 600,
                height: 630,
                objectFit: "cover",
              }}
            />
          ) : (
            // 썸네일 없을 때 — 진짜 곰돌이 마스코트 PNG (이모지 X)
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img
              src={bearMascotDataUrl}
              width={320}
              height={320}
              style={{ objectFit: "contain" }}
            />
          )}
        </div>

        {/* 우측 — 정보 */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 50,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column" }}>
            {post.brand_name && (
              <div
                style={{
                  fontSize: 26,
                  color: "#FB7185",
                  fontWeight: 700,
                  marginBottom: 14,
                  display: "flex",
                }}
              >
                {post.brand_name}
              </div>
            )}
            <div
              style={{
                fontSize: 44,
                color: "#0f172a",
                fontWeight: 900,
                lineHeight: 1.25,
                letterSpacing: -1,
                display: "flex",
              }}
            >
              {post.title.length > 60
                ? post.title.slice(0, 58) + "…"
                : post.title}
            </div>
            {dday && (
              <div
                style={{
                  marginTop: 26,
                  display: "flex",
                  background: dday.urgent ? "#FB7185" : "#0f172a",
                  color: "white",
                  padding: "10px 22px",
                  borderRadius: 999,
                  fontSize: 26,
                  fontWeight: 800,
                  alignSelf: "flex-start",
                }}
              >
                {dday.label}
              </div>
            )}
          </div>

          {/* 하단 브랜드 — 곰돌이 워터마크 + 텍스트 (이모지 X) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontSize: 22,
              color: "#64748b",
              fontWeight: 600,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img src={bearMascotDataUrl} width={44} height={44} />
            <span>엄빠레이더 · 엄빠 대신 매일 혜택 스캔 중 ♥</span>
          </div>
        </div>
      </div>
    ),
    size
  );
}
