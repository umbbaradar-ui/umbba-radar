// 모바일(375) 풀페이지 스크린샷 — 헤드리스 Chrome + CDP. 의존성 0 (Node 22+ 내장 WebSocket/fetch).
// UI 바꾸면 모바일부터 1차 검수(AGENTS.md)할 때 씀. 튜토리얼·설치배너는 localStorage 로 건너뜀.
// 사용: node tools/shot-mobile.mjs http://localhost:3000 out.png [width=375] [height=812]
//       EXPAND=1 이면 마감 레이더 "더보기"를 펼친 상태로 찍는다.
//       CHROME=/path/to/chrome 으로 실행파일 지정(기본: Windows 설치 경로 → 맥 경로 순).
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const [url, out, w = "375", h = "812"] = process.argv.slice(2);
import { existsSync } from "node:fs";
const CHROME = process.env.CHROME
  ?? ["C:/Program Files/Google/Chrome/Application/chrome.exe",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find(existsSync);
if (!CHROME) { console.error("Chrome 실행파일을 못 찾음 — CHROME=경로 로 지정"); process.exit(1); }
const PORT = 9333;
const chrome = spawn(CHROME, [
  "--headless=new", `--remote-debugging-port=${PORT}`, "--no-first-run", "--no-default-browser-check",
  `--window-size=${w},${h}`, "--hide-scrollbars", "--user-data-dir=" + (process.env.TEMP ?? process.env.TMPDIR ?? "/tmp") + "/umbba-shot-profile",
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const mid = ++id; pending.set(mid, { res, rej });
  ws.send(JSON.stringify({ id: mid, method, params }));
});

try {
  let targets;
  for (let i = 0; i < 40; i++) {
    try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); break; } catch { await sleep(250); }
  }
  const page = targets.find((t) => t.type === "page");
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id).res(m.result); pending.delete(m.id); } };

  await send("Emulation.setDeviceMetricsOverride", { width: +w, height: +h, deviceScaleFactor: 2, mobile: true });
  await send("Page.enable");
  // 1차 로드 → 튜토리얼 "봤음" 플래그 심고 → 재로드
  await send("Page.navigate", { url }); await sleep(4000);
  await send("Runtime.evaluate", { expression: `localStorage.setItem("umbba-radar:tutorial-seen","999"); localStorage.setItem("umbba-radar:install-banner-dismissed", String(Date.now()));` });
  await send("Page.navigate", { url }); await sleep(5000);
  // 선택: 마감 레이더 더보기 펼치기
  if (process.env.EXPAND) await send("Runtime.evaluate", { expression: `document.querySelector('#deadline-radar button')?.click()` });
  await sleep(800);
  const { contentSize } = await send("Page.getLayoutMetrics");
  const fullH = Math.min(Math.ceil(contentSize.height), 6000);
  await send("Emulation.setDeviceMetricsOverride", { width: +w, height: fullH, deviceScaleFactor: 2, mobile: true });
  await sleep(800);
  const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  writeFileSync(out, Buffer.from(data, "base64"));
  console.log("saved", out, `${w}x${fullH}`);
} finally {
  try { ws?.close(); } catch {}
  chrome.kill();
}
