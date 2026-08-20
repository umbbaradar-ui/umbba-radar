// ============================================
// Supabase 전량 조회 헬퍼 (1,000행 상한 회피)
//
// Supabase(PostgREST)는 1회 응답을 1,000행에서 조용히 자른다.
// "전량"이 필요한 조회는 반드시 이 페이지 루프를 쓸 것.
// (원래 curation/repository.ts 안에 있던 것을 공용으로 승격 — 2026-08-20)
// ============================================

import "server-only";

/** Supabase(PostgREST) 1회 응답 상한 */
export const PAGE_SIZE = 1000;

/**
 * 조건에 맞는 행 전량을 페이지 루프로 수집.
 *
 * @param label 에러 메시지에 붙일 호출부 이름
 * @param buildPage 호출마다 **새 쿼리 빌더**를 만들어 `.range(from, to)`까지 적용해 반환할 것
 *                  (Supabase 빌더는 1회용). 정렬에 `id` 2차 정렬 필수 — 페이지 경계 순서 고정.
 */
export async function fetchAllRows<T>(
  label: string,
  buildPage: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const all: T[] = [];
  for (;;) {
    const { data, error } = await buildPage(all.length, all.length + PAGE_SIZE - 1);
    if (error) throw new Error(`${label}: ${error.message}`);
    all.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break; // 마지막 페이지
  }
  return all;
}
