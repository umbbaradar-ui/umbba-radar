# 맥 이식 가이드 — 옵션 C 무인 수집·분류 (유료 API 0)

> 24시간 맥에 한 번 세팅하면, 매일 자동으로 **BD 수집 → 로컬 Claude 분류 → 검수 큐**가 돈다.
> 구조: `docs/COLLECTION-DIRECTION-FINAL-2026-06-21.md`. 백로그(밀린 draft)는 노트북에서 이미 정리됨 → 맥은 "앞으로의 자동화"만.

## 1. 받기
```bash
git clone https://github.com/umbbaradar-ui/umbba-radar.git   # 처음이면
cd umbba-radar/tools/umbba-cli
git pull                                                      # 이미 있으면 이것만
pip3 install requests python-dotenv                           # gallery-dl 불필요
```

## 2. `.env` (이 폴더에) — 토큰 4개
```
UMBBA_API_URL=https://umbba-radar.com
ADMIN_CLI_TOKEN=<서버 토큰>
BRIGHTDATA_API_TOKEN=<BD 토큰 — 재발급분 권장>
BRIGHTDATA_DATASET_ID=gd_lk5ns7kz21pck8jpis
CLAUDE_CODE_OAUTH_TOKEN=<`claude setup-token` 발급값(sk-ant-oat01-...)>
```
- `claude setup-token` 1회 실행 → 나온 토큰을 위 `CLAUDE_CODE_OAUTH_TOKEN` 에.
- (노트북 .env 를 AirDrop 으로 통째 복사 + CLAUDE_CODE_OAUTH_TOKEN 한 줄만 추가해도 됨)

## 3. 검증 (1회) — 수집+분류 직접 한 번
```bash
chmod +x bd-run.sh
./bd-run.sh 1
# bd-run-log.txt 에 "수집 → 분류 → done" + 검수 큐(/admin/queue)에 카드 들어오면 OK ✅
```
막히면:
- `claude 못 찾음` → `which claude` 확인 (보통 PATH 에 있음; 없으면 `export UMBBA_CLAUDE=$(which claude)`)
- `Not logged in` → `claude setup-token` 다시 + `.env` 토큰 확인
- 분류 배치 timeout → `./bd-run.sh 1 800 320 4` (배치 4로 더 작게)

## 4. 무인 스케줄 (launchd)
```bash
# plist 의 __UMBBA_CLI_DIR__ 를 실제 경로로, Hour/Minute 을 빈 시간대(다른 작업 안 겹치게)로 수정
sed -i '' "s#__UMBBA_CLI_DIR__#$(pwd)#g" com.umbba.bdrun.plist   # 경로 자동 치환
cp com.umbba.bdrun.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.umbba.bdrun.plist
# 확인: launchctl list | grep umbba    /    즉시테스트: launchctl start com.umbba.bdrun
```
→ 매일 새벽 3시(기본) **수집+분류 자동**. 검수 큐에 깨끗한 카드만 쌓임 → 발행만 사람이.

## 운영 메모
- **비용**: BD ~월 2.6만 + 분류=Claude 구독(추가 $0). 유료 Vision API 안 씀.
- **대부분 노이즈는 자동 삭제** → 검수 큐엔 진짜 모집만.
- 분류가 느리면(구독 경합) `batch` 를 4~6으로. 한도 닿아 일부 밀려도 다음날 자동 따라잡음.
- 토큰 노출분(BD·CLAUDE_OAUTH) 재발급 후 `.env` 교체 권장.
