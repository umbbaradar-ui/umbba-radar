@echo off
REM ============================================================
REM Account #2 scan (warm-up). Identical to scan.bat EXCEPT:
REM   - uses cookies2.txt (2nd dummy account) via UMBBA_COOKIES_FILE
REM     (process env beats .env: ingest.py load_dotenv override=False)
REM   - writes scan2-log.txt (separate log; do NOT clobber scan-log.txt)
REM Schedule ~15min AFTER each account-1 round so last_scanned_at has cycled
REM   -> account 2 picks DIFFERENT targets than account 1 (auto split).
REM WARM-UP RAMP (raise --max-accounts only while scan2-log stays block-free):
REM   day 4-5: 15 (1 round) -> day 6-7: 25 (2 rounds) -> day 8+: 40 (3 rounds)
REM ============================================================
chcp 65001 > nul
set PYTHONUTF8=1
set UMBBA_COOKIES_FILE=cookies2.txt
"C:\Users\myj87\AppData\Local\Programs\Python\Python314\python.exe" ingest.py --scan --max-accounts 15 --recent 3 > scan2-log.txt 2>&1
exit /b %ERRORLEVEL%
