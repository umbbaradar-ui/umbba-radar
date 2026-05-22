// ============================================
// 엄빠레이더 로고 — 인라인 SVG
// 컨셉: 동심원(레이더 sweep) + 중앙 채워진 점(스캔 결과)
// 색상은 currentColor로 부모 텍스트 색상을 따라감
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
      {/* 바깥 동심원 (가장 옅음) */}
      <circle
        cx="12"
        cy="12"
        r="11"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.2"
      />
      {/* 중간 동심원 */}
      <circle
        cx="12"
        cy="12"
        r="7.5"
        stroke="currentColor"
        strokeWidth="1.2"
        opacity="0.5"
      />
      {/* 내부 채워진 원 */}
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      {/* 가운데 점 (강조) */}
      <circle cx="12" cy="12" r="1.4" fill="white" />
    </svg>
  );
}
