# Headless auth smoke test. Run from a NORMAL terminal (outside the desktop-app
# container) so it matches the Task Scheduler's auth context. Does NOT touch
# Instagram - it only asks Claude a trivial question to confirm login works.

$exe = Get-ChildItem "$env:LOCALAPPDATA\Packages\*Claude*\LocalCache\Roaming\Claude\claude-code\*\claude.exe" -ErrorAction SilentlyContinue |
       Sort-Object { try { [version]$_.Directory.Name } catch { [version]'0.0.0' } } -Descending |
       Select-Object -First 1 -ExpandProperty FullName

if (-not $exe) { Write-Host "ERROR: claude.exe not found" -ForegroundColor Red; exit 1 }

Write-Host "Using: $exe" -ForegroundColor Cyan
Write-Host "--- response below (should print AUTH_OK, NOT 'Not logged in') ---" -ForegroundColor Cyan
"Reply with exactly: AUTH_OK" | & $exe -p --permission-mode bypassPermissions --model sonnet
Write-Host ""
Write-Host "--- exit code: $LASTEXITCODE ---" -ForegroundColor Cyan
