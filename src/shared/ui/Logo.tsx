// ============================================
// 엄빠레이더 로고 — 안테나 곰돌이 미니 SVG
// 컨셉: 안테나에 하트 단 동그란 곰돌이 (마스코트 미니 버전)
// 22px 같은 작은 사이즈에서도 또렷하게 보이도록 단순화
// 색상은 SVG 내부에 고정 (마스코트 브랜드 톤). className은 size/위치 조정용
// ============================================

interface Props {
  size?: number;
  className?: string;
}

export function Logo({ size = 24, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* 안테나 라인 */}
      <rect x="11.5" y="3.4" width="1" height="2.6" fill="#9B6B7C" rx="0.4" />

      {/* 안테나 위 하트 */}
      <path
        d="M12 2.6 C 11.4 1.9, 10.4 2, 10.4 2.9 C 10.4 3.7, 12 4.6, 12 4.6 C 12 4.6, 13.6 3.7, 13.6 2.9 C 13.6 2, 12.6 1.9, 12 2.6 Z"
        fill="#FB7185"
      />

      {/* 귀 외곽 — 머리 뒤에 살짝 보이도록 먼저 그림 */}
      <circle cx="7.2" cy="9.5" r="2.8" fill="#B89472" />
      <circle cx="16.8" cy="9.5" r="2.8" fill="#B89472" />

      {/* 머리 */}
      <circle cx="12" cy="14" r="6.6" fill="#E5C6A6" />

      {/* 귀 내부 (분홍) */}
      <circle cx="7.2" cy="9.5" r="1.3" fill="#F4B89A" />
      <circle cx="16.8" cy="9.5" r="1.3" fill="#F4B89A" />

      {/* 볼터치 (살짝 분홍) */}
      <ellipse cx="7" cy="15.4" rx="1.4" ry="1" fill="#FFB1C8" opacity="0.55" />
      <ellipse cx="17" cy="15.4" rx="1.4" ry="1" fill="#FFB1C8" opacity="0.55" />

      {/* 주둥이 (밝은 영역) */}
      <ellipse cx="12" cy="16.2" rx="3" ry="2.1" fill="#F8E4CC" />

      {/* 눈 */}
      <circle cx="9.5" cy="13.2" r="1.05" fill="#2D1810" />
      <circle cx="14.5" cy="13.2" r="1.05" fill="#2D1810" />
      {/* 눈동자 반사 (생기) */}
      <circle cx="9.85" cy="12.9" r="0.32" fill="white" />
      <circle cx="14.85" cy="12.9" r="0.32" fill="white" />

      {/* 코 */}
      <ellipse cx="12" cy="15.5" rx="0.7" ry="0.5" fill="#2D1810" />
    </svg>
  );
}
