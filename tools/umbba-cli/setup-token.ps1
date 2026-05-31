# One-time headless auth for Claude Code (run interactively; opens browser OAuth).
# IMPORTANT: %APPDATA%\Claude is a junction that only exists INSIDE the desktop-app
# (MSIX) container. A normal terminal / Task Scheduler must use the REAL physical
# path under the package LocalCache, which this script resolves below. ASCII-only
# output to avoid Windows PowerShell 5.1 encoding (mojibake) issues.

$exe = Get-ChildItem "$env:LOCALAPPDATA\Packages\*Claude*\LocalCache\Roaming\Claude\claude-code\*\claude.exe" -ErrorAction SilentlyContinue |
       Sort-Object { try { [version]$_.Directory.Name } catch { [version]'0.0.0' } } -Descending |
       Select-Object -First 1 -ExpandProperty FullName

if (-not $exe) {
    Write-Host "ERROR: bundled claude.exe not found under the Claude package LocalCache." -ForegroundColor Red
    Write-Host "Open the Claude desktop app once (so Claude Code is installed), then re-run this script." -ForegroundColor Yellow
    exit 1
}

Write-Host "Using: $exe" -ForegroundColor Cyan
Write-Host "A browser window will open. Log in with your subscription account and approve." -ForegroundColor Cyan
& $exe setup-token
exit $LASTEXITCODE
