// ============================================
// PWA shortcut 아이콘 자동 생성
// (manifest.shortcuts 각 항목별 96×96 고유 아이콘)
//
// 출력:
//   - public/icons/shortcut-my.png            (내 레이더 — 하트)
//   - public/icons/shortcut-experience.png    (체험단 — 선물 박스)
//   - public/icons/shortcut-kids-model.png    (키즈모델 — 카메라)
//   - public/icons/shortcut-submit.png        (제보 — 종이비행기)
//
// 디자인:
//   - 96×96 둥근 사각형 (rx 20)
//   - 배경: 브랜드 컬러 rose-500 (#FB7185)
//   - 심볼: 흰색 단순 SVG (시스템 폰트 의존 X)
//   - librsvg가 emoji 폰트 fallback이 불안정해서 그래픽 심볼로 직접 그림
//
// 실행: node scripts/generate-shortcut-icons.mjs
// ============================================

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OUT_DIR = resolve(ROOT, "public/icons");

const SIZE = 96;
const BG = "#FB7185"; // rose-500
const FG = "#FFFFFF";

/** 둥근 사각형 + 중앙 심볼 SVG 템플릿 */
function makeSvg(symbolMarkup) {
  return `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg">
  <rect width="96" height="96" rx="20" fill="${BG}"/>
  ${symbolMarkup}
</svg>`;
}

const SHORTCUTS = {
  // 홈화면 — 집 (지붕 + 몸체 + 문)
  "shortcut-home.png": `
    <path d="M48 18 L 80 44 L 80 78 L 16 78 L 16 44 Z" fill="${FG}"/>
    <rect x="40" y="54" width="16" height="24" fill="${BG}"/>
  `,

  // 내 레이더 — 하트 (브랜드 정체성)
  "shortcut-my.png": `<path d="M48 76 C 24 60, 16 44, 24 32 C 32 22, 44 24, 48 36 C 52 24, 64 22, 72 32 C 80 44, 72 60, 48 76 Z" fill="${FG}"/>`,

  // 체험단 — 선물 박스 (몸체 + 십자 리본 + 위쪽 매듭)
  "shortcut-experience.png": `
    <rect x="20" y="40" width="56" height="40" rx="4" fill="${FG}"/>
    <rect x="20" y="52" width="56" height="6" fill="${BG}"/>
    <rect x="45" y="40" width="6" height="40" fill="${BG}"/>
    <path d="M48 40 C 36 28, 28 36, 36 40 L 48 40 Z" fill="${FG}"/>
    <path d="M48 40 C 60 28, 68 36, 60 40 L 48 40 Z" fill="${FG}"/>
  `,

  // 제보 — 종이비행기
  "shortcut-submit.png": `
    <path d="M16 48 L 80 22 L 64 80 L 48 56 L 16 48 Z" fill="${FG}"/>
    <path d="M48 56 L 80 22" stroke="${BG}" stroke-width="2" fill="none"/>
  `,
};

// 사용 안 하는 shortcut-kids-model.png는 public/icons/에 잔존해도 무해 (manifest 미참조).
// 깔끔히 정리하려면 수동 삭제 가능.

async function ensureDir(dir) {
  await mkdir(dir, { recursive: true });
}

async function generate(filename, symbolMarkup) {
  const svg = makeSvg(symbolMarkup);
  const outPath = resolve(OUT_DIR, filename);
  await sharp(Buffer.from(svg))
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`✓ ${outPath} (96×96)`);
}

async function main() {
  await ensureDir(OUT_DIR);
  await Promise.all(
    Object.entries(SHORTCUTS).map(([file, sym]) => generate(file, sym))
  );
  console.log("\n모든 shortcut 아이콘 생성 완료.");
}

main().catch((err) => {
  console.error("아이콘 생성 실패:", err);
  process.exit(1);
});
