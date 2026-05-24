// ============================================
// 카드 상세 OG 이미지 — 카톡·페북·트위터 공유 시 카드별 미리보기
// 1200x630 (소셜 표준)
// 좌측: 썸네일 / 우측: 브랜드·제목·D-day
//
// Next.js 16 ImageResponse — 빌드 시간 정적 생성 (revalidate로 갱신)
// ============================================

import { ImageResponse } from "next/og";
import { getPost } from "@/modules/content/service";
import { calcDDay } from "@/shared/utils/dday";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "엄빠레이더 카드 상세";

// 60초마다 재생성 (카드 정보 변경 시 OG 이미지도 자동 갱신)
export const revalidate = 60;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PostOgImage({ params }: Props) {
  const { id } = await params;
  const post = await getPost(id);

  // 카드 없으면 폴백 (default OG로 fallthrough)
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
            background: "#FFF5F8",
            fontSize: 48,
            color: "#0f172a",
            fontWeight: 800,
          }}
        >
          엄빠레이더
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
            <div style={{ fontSize: 120, display: "flex" }}>🐻</div>
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

          {/* 하단 브랜드 */}
          <div
            style={{
              fontSize: 22,
              color: "#64748b",
              fontWeight: 600,
              display: "flex",
            }}
          >
            🐻  엄빠레이더 · 엄빠 대신 매일 혜택 스캔 중 ♥
          </div>
        </div>
      </div>
    ),
    size
  );
}
