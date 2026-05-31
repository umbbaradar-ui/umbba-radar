@echo off
REM 작업 스케줄러용 래퍼 - 한글 경로 회피(작업 디렉터리는 스케줄러 "시작 위치"로 지정)
REM 이 .bat 은 순수 ASCII 만 포함 → cmd 코드페이지 무관하게 안전
chcp 65001 > nul
set PYTHONUTF8=1
REM --max-accounts 50: 한 회차 50계정만(밤새 4회 트리거로 분산 → 202개 전부 커버, 봇 의심 완화).
REM last_scanned_at 오래된 순서라 회차마다 다음 50개를 자동으로 집어 중복 없이 순환.
"C:\Users\myj87\AppData\Local\Programs\Python\Python314\python.exe" ingest.py --scan --max-accounts 50 > scan-log.txt 2>&1
exit /b %ERRORLEVEL%
