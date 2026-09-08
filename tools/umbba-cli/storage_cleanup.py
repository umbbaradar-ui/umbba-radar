#!/usr/bin/env python3
"""card-images 버킷 정리 — 무료 1.1GB 초과 대응 (2026-09-08).
1) 만료(expired)·삭제된 카드의 이미지 삭제  2) 남은 이미지 1080px 이하·WebP 재압축(선택)
필요 env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (대시보드 Settings → API). .env 또는 환경변수.
사용:
  python3 storage_cleanup.py --report                 # 현황만
  python3 storage_cleanup.py --delete-expired --days 14   # 만료 14일 지난 카드 이미지 삭제
  python3 storage_cleanup.py --recompress --max 1080  # 남은 이미지 재압축(다운→리사이즈→재업로드, 같은 경로 덮어쓰기)
"""
import os, sys, argparse, io, time, requests
from datetime import datetime, timedelta, timezone

def load_env():
    for p in (os.path.join(os.path.dirname(__file__), ".env"), os.path.join(os.path.dirname(__file__), ".env.storage")):
        if os.path.exists(p):
            for ln in open(p):
                if "=" in ln and not ln.startswith("#"):
                    k, v = ln.strip().split("=", 1); os.environ.setdefault(k, v.strip().strip('"'))
load_env()
URL = os.environ.get("SUPABASE_URL", "https://rjhioctfiucuxwumrozg.supabase.co").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
if not KEY:
    sys.exit("SUPABASE_SERVICE_ROLE_KEY 필요 (대시보드 Settings → API → service_role). .env.storage 에 넣으세요.")
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
BUCKET = "card-images"

def list_objects():
    out, offset = [], 0
    while True:
        r = requests.post(f"{URL}/storage/v1/object/list/{BUCKET}", headers=H,
                          json={"prefix": "", "limit": 1000, "offset": offset, "sortBy": {"column": "name", "order": "asc"}}, timeout=60)
        r.raise_for_status(); rows = r.json()
        if not rows: break
        out += rows; offset += len(rows)
        if len(rows) < 1000: break
    return [o for o in out if o.get("id")]

def posts():
    out, offset = [], 0
    while True:
        r = requests.get(f"{URL}/rest/v1/posts", headers={**H, "Range-Unit": "items", "Range": f"{offset}-{offset+999}"},
                         params={"select": "id,status,deadline,thumbnail_url,updated_at"}, timeout=60)
        r.raise_for_status(); rows = r.json()
        out += rows
        if len(rows) < 1000: break
        offset += 1000
    return out

def parse_ts(d):
    if not d: return None
    d = d.replace("Z", "+00:00")
    import re
    d = re.sub(r"\.(\d+)", lambda m: "." + (m.group(1) + "000000")[:6], d)  # 소수초 6자리 보정 (py3.9)
    try: return datetime.fromisoformat(d)
    except ValueError: return None

def size(o): return int((o.get("metadata") or {}).get("size") or 0)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", action="store_true"); ap.add_argument("--delete-expired", action="store_true")
    ap.add_argument("--days", type=int, default=14); ap.add_argument("--recompress", action="store_true")
    ap.add_argument("--max", type=int, default=1080); ap.add_argument("--dry", action="store_true")
    ap.add_argument("--sweep", action="store_true", help="일일 잡: 고아+만료30일 삭제, 500MB 초과 시 텔레그램 경보")
    ap.add_argument("--alert-mb", type=int, default=500)
    a = ap.parse_args()
    if a.sweep:
        a.delete_expired = True; a.days = max(a.days, 30)
    objs = list_objects(); total = sum(size(o) for o in objs)
    print(f"objects {len(objs)}  total {total/1e6:.0f} MB  avg {total/max(1,len(objs))/1e3:.0f} KB")
    ps = posts(); used = {}
    for p in ps:
        u = p.get("thumbnail_url") or ""
        if f"/{BUCKET}/" in u: used[u.split(f"/{BUCKET}/", 1)[1]] = p
    now = datetime.now(timezone.utc); cutoff = now - timedelta(days=a.days)
    orphan, expired, live = [], [], []
    for o in objs:
        p = used.get(o["name"])
        if not p: orphan.append(o); continue
        d = p.get("deadline"); st = p.get("status")
        dd = parse_ts(d)
        if st == "expired" or (dd and dd < cutoff): expired.append(o)
        else: live.append(o)
    for name, grp in (("고아(카드에 안 쓰임)", orphan), (f"만료 {a.days}일+", expired), ("현역", live)):
        print(f"  {name:16s} {len(grp):5d}개  {sum(size(o) for o in grp)/1e6:6.0f} MB")
    if a.delete_expired:
        targets = [o["name"] for o in orphan + expired]
        print(f"삭제 대상 {len(targets)}개 {sum(size(o) for o in orphan+expired)/1e6:.0f} MB", "(dry)" if a.dry else "")
        if not a.dry:
            logp = os.path.join(os.path.dirname(__file__), f"storage_deleted_{datetime.now().strftime('%Y%m%d_%H%M')}.txt")
            with open(logp, "w") as f:
                for o in orphan: f.write(f"orphan\t{size(o)}\t{o['name']}\n")
                for o in expired: f.write(f"expired{a.days}\t{size(o)}\t{o['name']}\n")
            print("삭제 목록 저장:", logp)
            for i in range(0, len(targets), 100):
                r = requests.delete(f"{URL}/storage/v1/object/{BUCKET}", headers=H, json={"prefixes": targets[i:i+100]}, timeout=120)
                print("  delete", i, r.status_code, r.text[:80] if r.status_code != 200 else "")
    if a.sweep:
        remain = sum(size(o) for o in live) / 1e6
        msg = f"🗄 card-images 일일 정리: 삭제 {len(orphan)+len(expired)}개 {sum(size(o) for o in orphan+expired)/1e6:.0f}MB · 잔여 {remain:.0f}MB"
        FREE_MB = 1100
        pct = remain / FREE_MB * 100
        if pct >= 90: msg = "🚨🚨 " + msg + f" — 무료 한도의 {pct:.0f}%! 즉시 정리 필요 (은재 요청: 90% 도달 시 알림)"
        elif remain > a.alert_mb: msg = "🚨 " + msg + f" — {a.alert_mb}MB 초과! 무료 한도({FREE_MB}MB) 대비 {pct:.0f}%"
        try:
            env = {}
            for ln in open(os.path.join(os.path.dirname(__file__), ".env")):
                if "=" in ln and not ln.startswith("#"): k, v = ln.strip().split("=", 1); env[k] = v.strip().strip('"')
            if pct >= 90 or remain > a.alert_mb or (len(orphan) + len(expired)) > 0:
                requests.post(f"https://api.telegram.org/bot{env['TELEGRAM_BOT_TOKEN']}/sendMessage", data={"chat_id": env["TELEGRAM_CHAT_ID"], "text": msg}, timeout=30)
        except Exception as e:
            print("telegram fail", e)
        print(msg)
    if a.recompress:
        from PIL import Image
        big = [o for o in live if size(o) > 250_000]
        print(f"재압축 대상(250KB+) {len(big)}개 {sum(size(o) for o in big)/1e6:.0f} MB", "(dry)" if a.dry else "")
        if not a.dry:
            saved = 0
            for o in big:
                r = requests.get(f"{URL}/storage/v1/object/public/{BUCKET}/{o['name']}", timeout=60)
                if r.status_code != 200: continue
                im = Image.open(io.BytesIO(r.content)).convert("RGB"); im.thumbnail((a.max, a.max))
                buf = io.BytesIO(); im.save(buf, "JPEG", quality=82, optimize=True); data = buf.getvalue()
                if len(data) >= size(o): continue
                up = requests.post(f"{URL}/storage/v1/object/{BUCKET}/{o['name']}", headers={**H, "Content-Type": "image/jpeg", "x-upsert": "true", "cache-control": "31536000"}, data=data, timeout=120)
                if up.status_code in (200, 201): saved += size(o) - len(data)
                else: print("  upload fail", o["name"], up.status_code, up.text[:80])
                time.sleep(0.05)
            print(f"절감 {saved/1e6:.0f} MB")

if __name__ == "__main__":
    main()
