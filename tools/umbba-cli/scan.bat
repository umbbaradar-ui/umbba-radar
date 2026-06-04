@echo off
REM Task Scheduler wrapper - avoid Korean path (working dir set via scheduler "Start in")
REM This .bat is pure ASCII -> safe regardless of cmd codepage.
chcp 65001 > nul
set PYTHONUTF8=1
REM CONSERVATIVE (2026-06-04): recovered from an Instagram session ban that was
REM   triggered by over-scanning (80 accounts x 5 posts x 5 rounds = ~400/round).
REM --max-accounts 40: 40 accounts per round. 3 nightly rounds = 120/day.
REM   last_scanned_at oldest-first, so each round auto-picks the next 40 (no overlap, cycles).
REM   ~433 active accounts -> full loop every ~4 days. DO NOT raise the burst (it caused 401).
REM Triggers 3x: 21:30 / 00:00 / 02:30 (all before the B routine at 03:30).
REM --recent 3: 3 most-recent posts per account (1 page = 12; staying <=12 keeps calls flat).
"C:\Users\myj87\AppData\Local\Programs\Python\Python314\python.exe" ingest.py --scan --max-accounts 40 --recent 3 > scan-log.txt 2>&1
exit /b %ERRORLEVEL%
