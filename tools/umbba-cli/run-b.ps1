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
# Classification is Instagram-free (text only) -> NOT capped here anymore (2026-06-04):
# classify ALL exported todo each run so noise is pruned in one night. The only
# Instagram load (image download for skip=false) is bounded in ingest.py via
# UMBBA_B_MAX_IMAGES. 0=all; set UMBBA_B_MAXITEMS only to bound Claude time for testing.
$maxItems  = if ($env:UMBBA_B_MAXITEMS) { [int]$env:UMBBA_B_MAXITEMS } else { 0 }

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
   title, brand_name, body, search_keywords, kind ("recruiting" or "group_buy"), stage_categories (array), type_tags (array),
   topic, deadline (ISO8601 with +09:00, or null), confidence (number 0..1).
   Follow RULES.md for every value and all skip patterns. Use input.json today_kst
   for expiry checks. results count MUST equal input count; preserve every queue_id.
4. After results.json is written, reply with exactly: DONE
'@
$work = Join-Path $env:TEMP 'umbba-b'
$rulesPath = Join-Path $dir 'RULES.md'
$all = New-Object System.Collections.ArrayList
$totalCreated = 0; $importFailed = 0; $totalHeld = 0
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
      $bitems = @($r.items)
      foreach ($it in $bitems) { [void]$all.Add($it) }
      # Import THIS batch right away so progress survives a mid-run kill (Task Scheduler
      # ExecutionTimeLimit). Image download is only for skip=false in these 25 -> small.
      $bres = Join-Path $bw 'batch-results.json'
      WriteNoBom $bres (@{ items = $bitems } | ConvertTo-Json -Depth 10)
      $io = & $py ingest.py --import "$bres" 2>&1
      $io | Out-File -LiteralPath (Join-Path $exportDir ("import-{0}.txt" -f $b)) -Encoding utf8
      $bc = 0; $bf = 0; $bh = 0
      $sl = ($io | Select-String -Pattern 'IMPORT_SUMMARY' | Select-Object -Last 1)
      if ($sl) {
        $m = [regex]::Match($sl.ToString(), 'created=(\d+).*?failed=(\d+).*?held=(\d+)')
        if ($m.Success) { $bc = [int]$m.Groups[1].Value; $bf = [int]$m.Groups[2].Value; $bh = [int]$m.Groups[3].Value }
      }
      $totalCreated += $bc; $importFailed += $bf; $totalHeld += $bh
      Log ("batch {0}/{1} done: {2} items -> cards {3} (exit={4})" -f ($b + 1), $nb, $bitems.Count, $bc, $proc.ExitCode)
    }
    catch { Log ("batch {0} classify/import failed: {1}" -f ($b + 1), $_.Exception.Message) }
  }
  else {
    Log ("batch {0} FAILED: no results.json (exit={1})" -f ($b + 1), $proc.ExitCode)
  }
}
if ($all.Count -eq 0) { Log "ERROR: 0 classified - nothing imported"; exit 11 }

# 3+4) Per-batch import already ran inside the loop (crash-resilient). Finalize counters.
$createdCount = $totalCreated
$skipFalseCount = @($all | Where-Object { -not $_.skip }).Count
Log ("import done: classified={0}, cards created={1}, held={2}, failed={3}" -f $all.Count, $createdCount, $totalHeld, $importFailed)
if ($createdCount -eq 0 -and $skipFalseCount -gt 0) {
  Log "WARNING: 0 cards created but skip=false items existed -> image download likely blocked (cookie 401)"
}
Log "B routine done"

# ============================================================
# 5) Nightly health report -> Telegram (server builds + sends).
#    Measure LOCAL-only signals here (scan log, cookie age, B result)
#    and POST them; server merges DB stats and sends one message.
#    Failures are ignored (report is best-effort).
# ============================================================
try {
  # --- read API_URL / ADMIN_CLI_TOKEN from .env ---
  $apiUrl = 'https://www.umbba-radar.com'
  $cliTok = $null
  $envFile = Join-Path $dir '.env'
  if (Test-Path $envFile) {
    foreach ($ln in Get-Content -LiteralPath $envFile -Encoding UTF8) {
      if ($ln -match '^\s*UMBBA_API_URL\s*=\s*(.+)\s*$') { $apiUrl = $matches[1].Trim().Trim('"').Trim("'") }
      if ($ln -match '^\s*ADMIN_CLI_TOKEN\s*=\s*(.+)\s*$') { $cliTok = $matches[1].Trim().Trim('"').Trim("'") }
    }
  }

  # --- A-scan result from scan-log.txt (last round) ---
  # Parse only ASCII markers (log body is Korean; avoid non-ASCII regex):
  #   "[k/N]"  per-account progress -> N = accounts this round
  #   "401"    failed account (instagram unauthorized)
  #   "fetch"  a fetch line (post fetched ok)
  $scanOk = $true; $scanAccts = 0; $scanFetched = 0; $scanQueued = 0; $scanFailed = 0; $all401 = $false
  $scanLog = Join-Path $dir 'scan-log.txt'
  if (Test-Path $scanLog) {
    $sc = Get-Content -LiteralPath $scanLog -Raw -Encoding UTF8
    if (-not $sc) { $sc = '' }  # empty/missing log (e.g. scan force-stopped) -> avoid regex null exception
    $c401 = ([regex]::Matches($sc, 'HttpError')).Count  # count ALL instagram failures (401/400/login redirect), not just 401
    $cFetch = ([regex]::Matches($sc, 'fetch')).Count
    # last "[k/N]" gives accounts processed this round
    $prog = [regex]::Matches($sc, '\[(\d+)/(\d+)\]')
    if ($prog.Count -gt 0) { $scanAccts = [int]$prog[$prog.Count - 1].Groups[2].Value }
    $scanFailed = $c401
    $scanFetched = $cFetch
    $scanQueued = $cFetch   # approx: queued ~ fetched (new posts)
    # Majority-failed = cookie likely dead. Don't require literally ALL to fail:
    # a soft-ban often lets a handful through (e.g. 73/80 -> cookie still dead).
    if ($scanAccts -gt 0 -and $c401 -ge [math]::Ceiling($scanAccts * 0.6)) { $all401 = $true; $scanOk = $false }
    elseif ($c401 -gt 0) { $scanOk = $false }
  }

  # --- cookie age (days) ---
  $cookieAge = $null
  $ck = Join-Path $dir 'cookies.txt'
  if (Test-Path $ck) {
    $cookieAge = [int]([math]::Floor(((Get-Date) - (Get-Item $ck).LastWriteTime).TotalDays))
  }

  # --- B result (per-batch import accumulated totalHeld) ---
  $bHeld = $totalHeld

  if ($cliTok) {
    # b.ok must reflect REALITY: 0 cards created while skip=false items existed = failure
    # (the old code hardcoded $true + reported skip=true noise as "imported", hiding the 06-04 outage).
    $bOk = ($importFailed -eq 0) -and -not ($createdCount -eq 0 -and $skipFalseCount -gt 0)
    $payload = @{
      scan = @{ ok = $scanOk; accounts = $scanAccts; queued = $scanQueued; failed = $scanFailed; all401 = $all401 }
      b    = @{ ok = $bOk; classified = $all.Count; imported = $createdCount; held = $bHeld; failed = $importFailed }
      cookieAgeDays = $cookieAge
    } | ConvertTo-Json -Depth 6
    $resp = Invoke-RestMethod -Method Post -Uri ("{0}/api/admin/health-report" -f $apiUrl) `
      -Headers @{ Authorization = ("Bearer {0}" -f $cliTok) } `
      -ContentType 'application/json; charset=utf-8' -Body $payload -TimeoutSec 25
    Log ("health-report sent: {0}" -f ($resp | ConvertTo-Json -Compress))
  } else {
    Log "health-report skipped: no ADMIN_CLI_TOKEN"
  }
} catch {
  Log ("health-report failed (ignored): {0}" -f $_.Exception.Message)
}

exit 0
