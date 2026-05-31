@echo off
REM B routine wrapper (headless Claude) - pure ASCII only
REM Working dir is provided by Task Scheduler "Start in" (avoids non-ASCII cd)
chcp 65001 > nul
set PYTHONUTF8=1

REM Resolve the REAL bundled claude.exe under the MSIX package LocalCache.
REM %APPDATA%\Claude is a junction visible ONLY inside the desktop-app container;
REM Task Scheduler runs outside it, so we must use the physical LocalCache path.
set "CLAUDE_ROOT="
for /d %%P in ("%LOCALAPPDATA%\Packages\*Claude*") do (
  if exist "%%P\LocalCache\Roaming\Claude\claude-code" set "CLAUDE_ROOT=%%P\LocalCache\Roaming\Claude\claude-code"
)
if not defined CLAUDE_ROOT (
  echo ERROR: Claude package LocalCache not found under "%LOCALAPPDATA%\Packages"> b-log.txt
  exit /b 8
)

REM resolve newest claude.exe under <CLAUDE_ROOT>\<version>\ (by date desc)
set "CLAUDE_EXE="
for /f "delims=" %%D in ('dir /b /ad /o-d "%CLAUDE_ROOT%" 2^>nul') do (
  if not defined CLAUDE_EXE if exist "%CLAUDE_ROOT%\%%D\claude.exe" set "CLAUDE_EXE=%CLAUDE_ROOT%\%%D\claude.exe"
)
if not defined CLAUDE_EXE (
  echo ERROR: claude.exe not found under "%CLAUDE_ROOT%"> b-log.txt
  exit /b 9
)

echo [run-b] %DATE% %TIME% using "%CLAUDE_EXE%"> b-log.txt
type b-routine-prompt.txt | "%CLAUDE_EXE%" -p --permission-mode bypassPermissions --model sonnet >> b-log.txt 2>&1
exit /b %ERRORLEVEL%
