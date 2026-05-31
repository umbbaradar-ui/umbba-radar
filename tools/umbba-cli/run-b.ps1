# ============================================================
# B routine - PowerShell orchestrates; Claude classifies only.
#   1) PowerShell runs `ingest.py --auto-export`  (Korean path safe)
#   2) Claude classifies in small batches: reads input.json + RULES.md,
#      writes results.json - FILE-based only (no shell cmd / cd / pty / pipe),
#      run in an ASCII temp folder so no Korean path reaches Claude.
#   3) PowerShell runs `ingest.py --import results.json`
# Why: headless agentic Claude (orchestrating CLI in a console-less task) hangs.
#   Limiting Claude to pure file read/write classification is reliable.
# NOTE: keep this file PURE ASCII. Windows PowerShell 5.1 reads a BOM-less .ps1
#   as ANSI; non-ASCII (Korean / em-dash) then breaks parsing.
# Env knobs: UMBBA_B_BATCH (default 25), UMBBA_B_MAXITEMS (0=all; for testing).
# ============================================================
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$dir = $PSScriptRoot
$log = Join-Path $dir 'b-log.txt'
function Log($m) { ("[{0}] {1}" -f (Get-Date -Format 'HH:mm:ss'), $m) | Add-Content -LiteralPath $log -Encoding utf8 }
function WriteNoBom($path, $text) { [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false))) }

Set-Location $dir
$env:PYTHONUTF8 = '1'
"[run-b] $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File -LiteralPath $log -Encoding utf8

# resolve python + claude.exe
$py = "C:\Users\myj87\AppData\Local\Programs\Python\Python314\python.exe"
if (-not (Test-Path $py)) { $py = "py" }
$exe = Get-ChildItem "$env:LOCALAPPDATA\Packages\*Claude*\LocalCache\Roaming\Claude\claude-code\*\claude.exe" -ErrorAction SilentlyContinue |
       Sort-Object { try { [version]$_.Directory.Name } catch { [version]'0.0.0' } } -Descending |
       Select-Object -First 1 -ExpandProperty FullName
if (-not $exe) { Log "ERROR: claude.exe not found"; exit 9 }
Log "claude: $exe"

$batchSize = if ($env:UMBBA_B_BATCH)    { [int]$env:UMBBA_B_BATCH }    else { 25 }
$maxItems  = if ($env:UMBBA_B_MAXITEMS) { [int]$env:UMBBA_B_MAXITEMS } else { 50 }  # 야간 처리 상한(인스타 이미지 다운로드 burst 제한). 0=전체.

# 1) auto-export (no Instagram; Vercel queue -> todo-enriched.json)
Log "auto-export start"
& $py ingest.py --auto-export 2>&1 | Out-Null
$todo = Get-ChildItem (Join-Path $dir 'exports') -Recurse -Filter 'todo-enriched.json' -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $todo) { Log "ERROR: todo-enriched.json not found"; exit 10 }
$exportDir = $todo.Directory.FullName
$data = Get-Content -LiteralPath $todo.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
$todayKst = $data.today_kst
$items = @($data.items)
if ($maxItems -gt 0 -and $items.Count -gt $maxItems) { $items = @($items[0..($maxItems-1)]) }
Log ("classify target: {0} items (batch {1}, today_kst={2}, export={3})" -f $items.Count, $batchSize, $todayKst, $todo.Directory.Name)
if ($items.Count -eq 0) { Log "nothing to do - exit"; exit 0 }

# 2) classify in batches (Claude, file-based, ASCII work dir)
$prompt = @'
You are a classifier for the Korean parenting-deals service umbba-radar.
Work ONLY with files in your CURRENT folder. Do NOT run shell commands, do NOT cd,
do NOT use background tasks, do NOT ask questions.
Steps:
1. Read RULES.md (full ruleset) and input.json (items), both in the current folder.
2. Classify EVERY item in input.json.items exactly per RULES.md.
3. Write results.json in the current folder as UTF-8 JSON: an object {"items": [ ... ]}.
   Each result item MUST have these keys: queue_id (copy from input), skip (boolean),
   title, brand_name, body, search_keywords, stage_categories (array), type_tags (array),
   topic, deadline (ISO8601 with +09:00, or null), confidence (number 0..1).
   Follow RULES.md for every value and all skip patterns. Use input.json today_kst
   for expiry checks. results count MUST equal input count; preserve every queue_id.
4. After results.json is written, reply with exactly: DONE
'@
$work = Join-Path $env:TEMP 'umbba-b'
$rulesPath = Join-Path $dir 'RULES.md'
$all = New-Object System.Collections.ArrayList
$nb = [math]::Ceiling($items.Count / $batchSize)
for ($b = 0; $b -lt $nb; $b++) {
  $lo = $b * $batchSize
  $hi = [math]::Min(($b + 1) * $batchSize, $items.Count) - 1
  $batch = @($items[$lo..$hi])
  $bw = Join-Path $work ("batch{0}" -f $b)
  if (Test-Path $bw) { Remove-Item $bw -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $bw | Out-Null
  Copy-Item $rulesPath (Join-Path $bw 'RULES.md') -Force
  WriteNoBom (Join-Path $bw 'input.json') (@{ today_kst = $todayKst; count = $batch.Count; items = $batch } | ConvertTo-Json -Depth 10)
  WriteNoBom (Join-Path $bw 'prompt.txt') $prompt
  Log ("batch {0}/{1} classify start ({2} items)" -f ($b + 1), $nb, $batch.Count)
  $proc = Start-Process -FilePath $exe `
    -ArgumentList '-p', '--permission-mode', 'bypassPermissions', '--model', 'sonnet' `
    -WorkingDirectory $bw `
    -RedirectStandardInput (Join-Path $bw 'prompt.txt') `
    -RedirectStandardOutput (Join-Path $bw 'c-out.txt') `
    -RedirectStandardError (Join-Path $bw 'c-err.txt') `
    -NoNewWindow -Wait -PassThru
  $resFile = Join-Path $bw 'results.json'
  if (Test-Path $resFile) {
    try {
      $r = Get-Content -LiteralPath $resFile -Raw -Encoding UTF8 | ConvertFrom-Json
      foreach ($it in @($r.items)) { [void]$all.Add($it) }
      Log ("batch {0} done: {1} items (exit={2})" -f ($b + 1), @($r.items).Count, $proc.ExitCode)
    }
    catch { Log ("batch {0} results.json parse failed: {1}" -f ($b + 1), $_.Exception.Message) }
  }
  else {
    Log ("batch {0} FAILED: no results.json (exit={1})" -f ($b + 1), $proc.ExitCode)
  }
}
if ($all.Count -eq 0) { Log "ERROR: 0 classified - skip import"; exit 11 }

# 3) merge -> results.json in export dir
$resultsPath = Join-Path $exportDir 'results.json'
WriteNoBom $resultsPath (@{ items = $all } | ConvertTo-Json -Depth 10)
Log ("merged results.json: {0} items" -f $all.Count)

# 4) import (downloads images for skip=false, creates pending cards)
Log "import start"
& $py ingest.py --import "$resultsPath" 2>&1 | Out-Null
Log "B routine done"
exit 0
