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

const BRAND_BG = { r: 255, g: 245, b: 248, alpha: 1 }; // #FFF5F8 (pink-50)
const MASKABLE_SAFE_AREA = 0.8; // 중앙 80%에만 마스코트, 양옆 10%씩 패딩

async function ensureDir(file) {
  await mkdir(dirname(file), { recursive: true });
}

/** any purpose — 원본 비율 유지, 정확한 사이즈로 리사이즈 */
async function generateAny(size, outPath) {
  await ensureDir(outPath);
  await sharp(SOURCE)
    .resize(size, size, { fit: "contain", background: BRAND_BG })
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(outPath);
  console.log(`✓ ${outPath} (${size}×${size}, any)`);
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
    generateAny(192, resolve(ROOT, "public/icons/icon-192.png")),
    generateAny(512, resolve(ROOT, "public/icons/icon-512.png")),
    generateMaskable(192, resolve(ROOT, "public/icons/icon-maskable-192.png")),
    generateMaskable(512, resolve(ROOT, "public/icons/icon-maskable-512.png")),
    generateAny(180, resolve(ROOT, "public/icons/apple-touch-icon.png")),
    // 스플래시·인앱 사용 (SplashScreen 140px, InstallBanner 36px → 300px면 충분)
    generateAny(300, resolve(ROOT, "public/bear-mascot.png")),
    // src/app/ 내부 — Next.js metadata 자동 처리용 (탭 favicon, HTML head 등)
    generateAny(512, resolve(ROOT, "src/app/icon.png")),
    generateAny(180, resolve(ROOT, "src/app/apple-icon.png")),
  ]);
  console.log("\n모든 PWA 아이콘 생성 완료.");
}

main().catch((err) => {
  console.error("아이콘 생성 실패:", err);
  process.exit(1);
});
