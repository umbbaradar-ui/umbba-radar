// ============================================
// 회원 활동 통계 패널 — /admin/users 상단
// 카드/트래픽이 아니라 "사람"에 대한 지표만 (가입·온보딩·재방문·코호트)
// ============================================

import type { MemberStats } from "@/modules/user/member-stats-service";

function pct(n: number, d: number): string {
  if (d <= 0) return "—";
  return `${Math.round((n / d) * 100)}%`;
}

/** 잔존율에 따라 셀 배경 농도 — 눈으로 코호트 흐름을 읽게 */
function heat(n: number, size: number): string {
  if (size <= 0) return "bg-slate-50 text-slate-300";
  const r = n / size;
  if (r >= 0.6) return "bg-emerald-500 text-white font-bold";
  if (r >= 0.4) return "bg-emerald-300 text-emerald-950 font-bold";
  if (r >= 0.2) return "bg-emerald-100 text-emerald-900";
  if (r > 0) return "bg-amber-50 text-amber-800";
  return "bg-slate-50 text-slate-300";
}

export function MemberStatsPanel({ stats }: { stats: MemberStats }) {
  const {
    total,
    withChildren,
    withPush,
    active7,
    active30,
    returning,
    neverActive,
    activeDaysDist: dist,
    providerMix,
    signupByWeek,
    cohorts,
    conversion,
  } = stats;

  const maxSignup = Math.max(...signupByWeek.map((s) => s.count), 1);

  return (
    <section className="mb-6 space-y-4">
      {/* 1. 회원 퍼널 — 가입해서 실제로 쓰기까지 어디서 새는지 */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">회원 퍼널</h2>
        <p className="mt-0.5 mb-3 text-[11px] text-slate-400">
          가입한 사람이 실제로 쓰기까지 어디서 새는지
        </p>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <FunnelCell label="가입" value={total} sub="전체 회원" />
          <FunnelCell
            label="자녀 등록"
            value={withChildren}
            sub={`${pct(withChildren, total)} 온보딩 완료`}
            tone={withChildren / Math.max(total, 1) >= 0.8 ? "good" : "warn"}
          />
          <FunnelCell
            label="30일 내 방문"
            value={active30}
            sub={`${pct(active30, total)} 활성`}
            tone={active30 / Math.max(total, 1) >= 0.3 ? "good" : "warn"}
          />
          <FunnelCell
            label="7일 내 방문"
            value={active7}
            sub={pct(active7, total)}
            tone={active7 > 0 ? "good" : "warn"}
          />
          <FunnelCell
            label="푸시 구독"
            value={withPush}
            sub={`${pct(withPush, total)} 옵트인`}
            tone={withPush / Math.max(total, 1) >= 0.3 ? "good" : "warn"}
          />
        </div>
      </div>

      {/* 2. 재방문 · 활동 강도 */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">재방문</h2>
          <p className="mt-0.5 mb-3 text-[11px] text-slate-400">
            가입일 말고 <em>다른 날</em>에도 온 적이 있는가
          </p>
          <div className="flex items-end gap-4">
            <div>
              <div className="text-3xl font-extrabold tracking-tight text-slate-900">
                {pct(returning, total)}
              </div>
              <div className="text-[11px] text-slate-500">
                {returning}명 / {total}명 재방문
              </div>
            </div>
            <div className="mb-1 text-[11px] leading-relaxed text-slate-500">
              가입만 하고 활동 기록 없음{" "}
              <strong className="text-rose-600">{neverActive}명</strong>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">활동 강도 (최근 30일)</h2>
          <p className="mt-0.5 mb-3 text-[11px] text-slate-400">
            회원 1명이 30일 중 며칠이나 왔는가
          </p>
          <div className="space-y-1.5">
            <DistBar label="0일 (휴면)" n={dist.d0} total={total} tone="slate" />
            <DistBar label="1일" n={dist.d1} total={total} tone="amber" />
            <DistBar label="2~3일" n={dist.d2to3} total={total} tone="emerald" />
            <DistBar label="4~7일" n={dist.d4to7} total={total} tone="emerald" />
            <DistBar label="8일 이상" n={dist.d8plus} total={total} tone="emerald" />
          </div>
        </div>
      </div>

      {/* 3. 가입 추이 + 로그인 수단 */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">주별 신규 가입</h2>
          <p className="mt-0.5 mb-3 text-[11px] text-slate-400">최근 8주 · 월요일 시작 (KST)</p>
          {signupByWeek.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">데이터 없음</p>
          ) : (
            <div className="flex items-end gap-1.5">
              {signupByWeek.map((s) => (
                <div key={s.week} className="flex-1 text-center">
                  <div className="mb-1 text-[10px] font-bold text-slate-700">{s.count}</div>
                  <div
                    className="mx-auto w-full rounded-t bg-rose-400"
                    style={{ height: `${Math.max((s.count / maxSignup) * 48, 2)}px` }}
                    title={`${s.week} 주 · ${s.count}명`}
                  />
                  <div className="mt-1 text-[9px] text-slate-400">{s.week.slice(5)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900">방문 → 가입 전환 (30일)</h2>
          <p className="mt-0.5 mb-3 text-[11px] text-slate-400">
            비로그인 방문자 대비 신규 가입
          </p>
          <div className="text-3xl font-extrabold tracking-tight text-slate-900">
            {(conversion.rate * 100).toFixed(1)}%
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            익명 방문 {conversion.anonVisitors30d}명 · 신규 가입{" "}
            <strong className="text-slate-800">{conversion.newMembers30d}명</strong>
          </div>
          <div className="mt-3 space-y-1">
            <div className="text-[11px] font-medium text-slate-600">로그인 수단</div>
            <div className="flex flex-wrap gap-1">
              {providerMix.map((p) => (
                <span
                  key={p.provider}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
                >
                  {p.provider} {p.count}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. 코호트 리텐션 — 규모가 작을 땐 비율보다 이 표가 정직하다 */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900">가입 주차별 잔존 (코호트)</h2>
        <p className="mt-0.5 mb-3 text-[11px] text-slate-400">
          세로=가입한 주, 가로=가입 후 N주차에 방문한 사람 수. 빈칸은 아직 그 주차가
          안 온 것(0명과 다름).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-xs">
            <thead>
              <tr className="text-slate-400">
                <th className="px-2 py-1 text-left font-medium">가입 주</th>
                <th className="px-2 py-1 text-right font-medium">가입</th>
                {["W0", "W1", "W2", "W3", "W4"].map((h) => (
                  <th key={h} className="px-2 py-1 text-center font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.week}>
                  <td className="whitespace-nowrap px-2 py-1 text-slate-600">
                    {c.week.slice(5)}
                  </td>
                  <td className="px-2 py-1 text-right font-bold text-slate-800">{c.size}</td>
                  {c.retained.map((n, i) => (
                    <td key={i} className="px-1 py-1">
                      {n === null ? (
                        <div className="rounded bg-slate-50/60 py-1 text-center text-slate-200">
                          ·
                        </div>
                      ) : (
                        <div
                          className={`rounded py-1 text-center ${heat(n, c.size)}`}
                          title={`${n}명 / ${c.size}명 (${pct(n, c.size)})`}
                        >
                          {n}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="rounded-lg bg-slate-100 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
        <strong>모든 &quot;방문&quot;은 활동 이벤트(카드 클릭·필터·검색) 기준</strong>입니다.
        로그인 시각(<em>최근 인증</em>)이 아니라 실제 행동이라 정확하지만, 화면을 열고
        아무것도 누르지 않은 방문은 아직 집계되지 않습니다 — 즉 재방문율·잔존은 실제보다
        <strong> 낮게</strong> 나옵니다(app_open 이벤트 추가 후 해소). 익명 방문자 수도
        브라우저·앱마다 ID가 따로 생겨 부풀어 있어, 전환율은 <strong>하한값</strong>입니다.
      </p>
    </section>
  );
}

function FunnelCell({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  tone?: "good" | "warn";
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2.5">
      <div className="text-[11px] font-medium text-slate-500">{label}</div>
      <div className="mt-0.5 text-xl font-extrabold tracking-tight text-slate-900">
        {value.toLocaleString()}
      </div>
      <div
        className={`text-[10px] ${
          tone === "good"
            ? "text-emerald-700"
            : tone === "warn"
              ? "text-amber-700"
              : "text-slate-400"
        }`}
      >
        {sub}
      </div>
    </div>
  );
}

function DistBar({
  label,
  n,
  total,
  tone,
}: {
  label: string;
  n: number;
  total: number;
  tone: "slate" | "amber" | "emerald";
}) {
  const width = total > 0 ? (n / total) * 100 : 0;
  const color =
    tone === "emerald" ? "bg-emerald-400" : tone === "amber" ? "bg-amber-400" : "bg-slate-300";
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-[11px] text-slate-500">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
      </div>
      <span className="w-10 shrink-0 text-right text-[11px] font-bold text-slate-700">{n}</span>
    </div>
  );
}
