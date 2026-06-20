# register-bd-task.ps1 - 홈 PC에 "엄빠레이더-BD수집" 일일 자동 태스크 등록.
# 기존 gallery-dl 태스크(엄빠레이더-스캔, umbba-scan1 등)는 건드리지 않음 -> 병행 운영용.
# 관리자 PowerShell에서 폴더 복사 + .env(BRIGHTDATA_API_TOKEN, ADMIN_CLI_TOKEN) 세팅 후 실행:
#   powershell -NoProfile -ExecutionPolicy Bypass -File register-bd-task.ps1
#
# 기본: 매일 22:00 KST, 활성계정 전체, 최근 1일(--scan-days 1 = 일일 운영 시 재과금 최소).
# StartWhenAvailable 이라 PC가 꺼져 있었으면 켜질 때 자동 보충.

$ErrorActionPreference = 'Stop'
$dir = $PSScriptRoot
if (-not $dir) { $dir = (Get-Location).Path }

foreach ($f in 'bd-scan.ps1','bd_ingest.py','bd_client.py') {
  if (-not (Test-Path (Join-Path $dir $f))) {
    Write-Host "ERROR: missing $f in $dir - copy the full umbba-cli folder first."; exit 1
  }
}

$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument ('-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" -ScanDays 1' -f (Join-Path $dir 'bd-scan.ps1')) `
  -WorkingDirectory $dir

$trigger = New-ScheduledTaskTrigger -Daily -At ([datetime]::Today.AddHours(22))

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -WakeToRun -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 4)

Register-ScheduledTask -TaskName '엄빠레이더-BD수집' -Force `
  -Action $action -Trigger $trigger -Settings $settings | Out-Null

$next = (Get-ScheduledTaskInfo -TaskName '엄빠레이더-BD수집').NextRunTime
Write-Host ("OK  엄빠레이더-BD수집 -> bd-scan.ps1 (daily 22:00, --scan-days 1)  next=$next")
Write-Host ""
Write-Host "병행 1~2일 검증 후, 기존 gallery-dl 태스크는 다음으로 끄면 됨(쿠키/401 졸업):"
Write-Host "  Disable-ScheduledTask -TaskName '엄빠레이더-스캔'"
Write-Host "  Disable-ScheduledTask -TaskName 'umbba-scan1'"
Write-Host "확인: Get-ScheduledTask | Where-Object { `$_.TaskName -match 'BD수집|엄빠|umbba' }"
