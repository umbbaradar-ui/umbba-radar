@echo off
REM 작업 스케줄러용 래퍼 - 한글 경로 회피(작업 디렉터리는 스케줄러 "시작 위치"로 지정)
REM 이 .bat 은 순수 ASCII 만 포함 → cmd 코드페이지 무관하게 안전
chcp 65001 > nul
set PYTHONUTF8=1
REM --max-accounts 60: 한 회차 60계정(밤새 4회 = 240/일 커버. 계정 330+ 대응, 봇 의심 완화).
REM last_scanned_at 오래된 순서라 회차마다 다음 60개를 자동으로 집어 중복 없이 순환.
REM 계정 500+ 되면 회차 수를 4->6회로 늘릴 것(회차당은 60 유지 권장; burst 키우면 401 위험).
"C:\Users\myj87\AppData\Local\Programs\Python\Python314\python.exe" ingest.py --scan --max-accounts 60 > scan-log.txt 2>&1
exit /b %ERRORLEVEL%
