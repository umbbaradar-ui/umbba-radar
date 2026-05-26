// ============================================
// PWA 아이콘 자동 생성 스크립트
//
// 원본: assets/bear-mascot-source.png (1254×1254, ~1.3MB, public/ 밖에 보관)
// 출력:
//   - public/icons/icon-192.png        (any, 192×192)
//   - public/icons/icon-512.png        (any, 512×512)
//   - public/icons/icon-maskable-192.png (maskable, 192×192, 80% safe area)
//   - public/icons/icon-maskable-512.png (maskable, 512×512, 80% safe area)
//   - public/icons/apple-touch-icon.png  (180×180, iOS)
//   - public/bear-mascot.png           (스플래시·인앱 사용, 300×300, ~30KB)
//   - src/app/icon.png                 (브라우저 탭/HTML head, 512×512)
//   - src/app/apple-icon.png           (iOS, 180×180)
//
// maskable: Android 어댑티브 아이콘이 원/사각/물방울 등 다양한 모양으로
// 자르므로, 중앙 80% 영역에만 마스코트가 들어가도록 패딩 추가.
// 배경색은 브랜드 배경색(#FFF5F8 = pink-50)으로 채움.
//
// 실행: node scripts/generate-pwa-icons.mjs
// ============================================

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SOURCE = resolve(ROOT, "assets/bear-mascot-source.png");

// 배경 톤 — shortcuts 아이콘과 통일 (rose-500 진한 핑크)
const BRAND_BG = { r: 251, g: 113, b: 133, alpha: 1 }; // #FB7185 (rose-500)
// 옅은 톤 (스플래시·SNS OG 등에서만 사용)
const SOFT_BG = { r: 255, g: 245, b: 248, alpha: 1 }; // #FFF5F8 (pink-50)
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const MASKABLE_SAFE_AREA = 0.8; // 중앙 80%에만 마스코트, 양옆 10%씩 패딩
const ROUNDED_RADIUS_RATIO = 0.22; // iOS·Android 일반 둥근 사각형 비율 (22%)

async function ensureDir(file) {
  await mkdir(dirname(file), { recursive: true });
}

/** any purpose (둥근 사각형 + 투명 배경)
 *  PNG 자체가 둥근 사각형 모양 + 외각 알파 0 → Play Store·OS launcher가 클립할 때
 *  검정/회색 모서리 안 보임. 자체 둥근 모서리라 어디서 표시되든 일관된 모양.
 */
async function generateAny(size, outPath) {
  await ensureDir(outPath);
  const radius = Math.round(size * ROUNDED_RADIUS_RATIO);

  // 1. 둥근 사각형 핑크 배경 (외부는 알파 0)
  const bgSvg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}"
          fill="rgb(${BRAND_BG.r},${BRAND_BG.g},${BRAND_BG.b})"/>
  </svg>`;
  const bg = await sharp(Buffer.from(bgSvg))
    .png()
    .toBuffer();

  // 2. 마스코트 — 캔버스 85% 크기로 안에 들어감
  const innerSize = Math.round(size * 0.85);
  const innerOffset = Math.round((size - innerSize) / 2);
  const mascot = await sharp(SOURCE)
    .resize(innerSize, innerSize, { fit: "contain", background: TRANSPARENT })
    .png()
    .toBuffer();

  // 3. 합성 — 둥근 핑크 배경 위에 마스코트, 외각은 SVG의 알파 0 유지
  await sharp(bg)
    .composite([{ input: mascot, top: innerOffset, left: innerOffset }])
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(outPath);
  console.log(`✓ ${outPath} (${size}×${size}, any rounded, alpha)`);
}

/** any purpose (정사각형 + 옅은 핑크 배경) — 스플래시·SNS 공유용
 *  bear-mascot.png는 SplashScreen·OG 이미지에서 정사각형 그대로 사용
 *  (둥근 마스크 적용하면 OG 이미지 안에서 모서리 어색).
 *  배경은 옅은 핑크(SOFT_BG) — OG 이미지의 그라데이션 배경과 자연스럽게 섞임.
 */
async function generateAnyFlat(size, outPath) {
  await ensureDir(outPath);
  await sharp(SOURCE)
    .resize(size, size, { fit: "contain", background: SOFT_BG })
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(outPath);
  console.log(`✓ ${outPath} (${size}×${size}, any flat, no alpha)`);
}

/** maskable purpose — 중앙 80%에 마스코트, 주변 핑크 배경 패딩 */
async function generateMaskable(size, outPath) {
  await ensureDir(outPath);
  const innerSize = Math.round(size * MASKABLE_SAFE_AREA);
  const padding = Math.round((size - innerSize) / 2);

  const inner = await sharp(SOURCE)
    .resize(innerSize, innerSize, { fit: "contain", background: BRAND_BG })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_BG,
    },
  })
    .composite([{ input: inner, top: padding, left: padding }])
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(outPath);
  console.log(`✓ ${outPath} (${size}×${size}, maskable, ${Math.round(MASKABLE_SAFE_AREA * 100)}% safe area)`);
}

async function main() {
  await Promise.all([
    // PWA·Android launcher용 — 둥근 사각형 + 투명 외각 (검정 모서리 방지)
    generateAny(192, resolve(ROOT, "public/icons/icon-192.png")),
    generateAny(512, resolve(ROOT, "public/icons/icon-512.png")),
    generateAny(180, resolve(ROOT, "public/icons/apple-touch-icon.png")),
    generateAny(512, resolve(ROOT, "src/app/icon.png")),
    generateAny(180, resolve(ROOT, "src/app/apple-icon.png")),

    // Android 어댑티브용 — OS가 다양한 모양(원/사각/물방울)으로 자르므로
    // 정사각형 + 핑크 배경 + 80% safe area 유지
    generateMaskable(192, resolve(ROOT, "public/icons/icon-maskable-192.png")),
    generateMaskable(512, resolve(ROOT, "public/icons/icon-maskable-512.png")),

    // 스플래시·SNS OG 이미지 안에서 사용 — 정사각형 + 핑크 배경 (둥근 모서리 X)
    generateAnyFlat(300, resolve(ROOT, "public/bear-mascot.png")),
  ]);
  console.log("\n모든 PWA 아이콘 생성 완료.");
}

main().catch((err) => {
  console.error("아이콘 생성 실패:", err);
  process.exit(1);
});
