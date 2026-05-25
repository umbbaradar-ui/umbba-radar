// ============================================
// Play Store Feature Graphic 생성
// 1024×500 (Play Console 필수 자산)
//
// 디자인:
//   - 배경: 핑크 그라데이션 (OG 이미지와 통일)
//   - 좌측: 곰돌이 마스코트 + 레이더 원 3겹
//   - 우측: 브랜드 타이틀 + 슬로건 + 짧은 설명
//
// 출력: public/feature-graphic.png
//   (Play Console UI에 별도 업로드용. Vercel 빌드 시 같이 deploy되어
//    필요하면 https://umbba-radar.com/feature-graphic.png 로 미리보기도 가능)
//
// 실행: node scripts/generate-feature-graphic.mjs
// ============================================

import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BEAR_PATH = resolve(ROOT, "public/bear-mascot.png");
const OUT_PATH = resolve(ROOT, "public/feature-graphic.png");

const W = 1024;
const H = 500;

async function main() {
  await mkdir(dirname(OUT_PATH), { recursive: true });

  // 1. 마스코트 PNG 로딩 + 리사이즈 (좌측 영역에 들어갈 사이즈)
  const bearBuffer = await readFile(BEAR_PATH);
  const BEAR_SIZE = 280;
  const bearResized = await sharp(bearBuffer)
    .resize(BEAR_SIZE, BEAR_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // 2. SVG 배경 + 레이더 + 텍스트 (sharp 직접 합성에 SVG 사용)
  //    레이더 원은 SVG로, 마스코트는 PNG composite, 폰트는 시스템 의존이지만
  //    Pretendard 시스템 폰트 fallback 무난.
  const bgSvg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFF4E6"/>
      <stop offset="100%" stop-color="#FFE4D6"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- 좌측 레이더 원 3겹 (마스코트 뒤로 깔림) -->
  <g transform="translate(220, 250)">
    <circle r="200" stroke="#FB7185" stroke-width="8" fill="none" opacity="0.15"/>
    <circle r="140" stroke="#FB7185" stroke-width="8" fill="none" opacity="0.35"/>
    <circle r="95" fill="#FFE4EC"/>
  </g>

  <!-- 우측 텍스트 -->
  <text x="500" y="195" font-family="-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard', 'Noto Sans KR', sans-serif"
        font-size="76" font-weight="900" fill="#0f172a" letter-spacing="-3">엄빠레이더</text>

  <text x="500" y="255" font-family="-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard', 'Noto Sans KR', sans-serif"
        font-size="30" font-weight="700" fill="#FB7185">엄빠 대신 매일 혜택 스캔 중 ♥</text>

  <text x="500" y="320" font-family="-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard', 'Noto Sans KR', sans-serif"
        font-size="22" font-weight="500" fill="#64748b">임신·출산·육아 협찬과 체험단</text>
  <text x="500" y="352" font-family="-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard', 'Noto Sans KR', sans-serif"
        font-size="22" font-weight="500" fill="#64748b">놓치는 혜택 없게 한곳에 모아드려요</text>
</svg>`;

  // 3. 배경 + 마스코트 합성 (마스코트는 레이더 가운데에 위치)
  await sharp(Buffer.from(bgSvg))
    .composite([
      {
        input: bearResized,
        left: Math.round(220 - BEAR_SIZE / 2), // 레이더 중심 x=220
        top: Math.round(250 - BEAR_SIZE / 2),  // 레이더 중심 y=250
      },
    ])
    .png({ compressionLevel: 9 })
    .toFile(OUT_PATH);

  console.log(`✓ ${OUT_PATH} (${W}×${H})`);
  console.log("\nPlay Console > 스토어 등록정보 > 그래픽 > 기능 그래픽에 업로드");
}

main().catch((err) => {
  console.error("Feature graphic 생성 실패:", err);
  process.exit(1);
});
