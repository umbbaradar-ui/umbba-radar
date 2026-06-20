# bd-scan.ps1 - Bright Data ingest runner for Task Scheduler (gallery-dl 스캔 대체).
# bd_ingest.py 실행: 활성계정 -> BD discover(start_date 신규필터) -> CDN이미지 -> bulk-ingest(AI+pending카드).
# 쿠키/401 없음. .env 필요: BRIGHTDATA_API_TOKEN, ADMIN_CLI_TOKEN (UMBBA_COOKIES_FILE 불필요).
# 스케줄러는 "시작 위치"를 이 폴더로 두고 호출 (한글 경로 안전, cd 안 씀).
param(
  [int]$MaxAccounts = 800,
  [int]$ScanDays = 2   # 실행 주기와 맞춰야 재과금 최소 (매일 실행이면 2 권장: 한 번 놓쳐도 커버)
)
$ErrorActionPreference = 'Continue'
$dir = $PSScriptRoot
if (-not $dir) { $dir = (Get-Location).Path }
Set-Location $dir
[Environment]::CurrentDirectory = $dir   # child python이 PROCESS cwd 상속 (.env 여기서 로드)
$env:PYTHONUTF8 = '1'
# portable python: UMBBA_PYTHON -> 'py' 런처 -> 'python'
$py = if ($env:UMBBA_PYTHON) { $env:UMBBA_PYTHON } elseif (Get-Command py -ErrorAction SilentlyContinue) { 'py' } else { 'python' }
$log = Join-Path $dir 'bd-ingest-log.txt'

("===== [{0}] bd-scan start (max={1} days={2}) =====" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $MaxAccounts, $ScanDays) | Add-Content -Path $log -Encoding UTF8
& $py bd_ingest.py --max-accounts $MaxAccounts --scan-days $ScanDays *>> $log
$code = $LASTEXITCODE
("[{0}] bd-scan done (exit {1})" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $code) | Add-Content -Path $log -Encoding UTF8
exit $code
