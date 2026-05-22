// ============================================
// AdSlot — 광고 슬롯 placeholder
// Phase 1: 항상 null 반환 (자리만 잡아둠)
// Phase 3: Advertising 부서의 service를 호출해 활성 광고 가져와 렌더
//
// 디버그 토글: .env.local 에 NEXT_PUBLIC_DEBUG_ADS=true 추가하면
//             슬롯 위치가 노란 점선 박스로 시각화됨 (개발용)
// ============================================

export type AdSlotId =
  | "top_banner" // 메인 페이지 헤더 아래
  | "category_top" // 필터 적용 시 그리드 상단
  | "detail_bottom" // 카드 상세 페이지 하단
  | "my_top" // /my 페이지 상단
  | "submit_top"; // /submit 페이지 상단

interface Props {
  id: AdSlotId;
  /** category_top 등에서 컨텍스트 전달 (필터 카테고리 매칭용) */
  context?: {
    stage?: string;
    type?: string;
    post_id?: string;
  };
  /** 슬롯 높이 가이드 (Phase 3에 광고가 들어가도 layout shift 안 일어나게) */
  reservedHeight?: number;
}

const isDebug = process.env.NEXT_PUBLIC_DEBUG_ADS === "true";

export function AdSlot({ id, context, reservedHeight }: Props) {
  if (isDebug) {
    return (
      <div
        className="my-2 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-amber-400 bg-amber-50/50 px-4 py-5 text-center text-xs text-amber-700"
        style={reservedHeight ? { minHeight: reservedHeight } : undefined}
      >
        <span className="font-bold tracking-wider">광고 슬롯: {id}</span>
        {context && (
          <code className="text-[10px] text-amber-600">
            {JSON.stringify(context)}
          </code>
        )}
        <span className="text-[10px] text-amber-500">
          Phase 3에 활성화 · 지금은 비어 있음
        </span>
      </div>
    );
  }
  // Phase 1: 슬롯은 자리만 잡고 아무것도 안 보임
  return null;
}
