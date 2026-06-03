@echo off
REM 작업 스케줄러용 래퍼 - 한글 경로 회피(작업 디렉터리는 스케줄러 "시작 위치"로 지정)
REM 이 .bat 은 순수 ASCII 만 포함 → cmd 코드페이지 무관하게 안전
chcp 65001 > nul
set PYTHONUTF8=1
REM --max-accounts 80: 한 회차 80계정(밤새 5회 = 400/일 = 계정 ~400명 매일 1바퀴 완주).
REM last_scanned_at 오래된 순서라 회차마다 다음 80개를 자동으로 집어 중복 없이 순환.
REM 계정 480 넘으면: 회차당(80)보다 트리거 회차 수를 늘려 분산할 것(burst 키우면 401 위험).
REM 트리거 5회: 21:00 / 22:30 / 00:00 / 01:30 / 02:50 (B루틴 03:00 직전까지).
REM --recent 5: 계정당 최근 5개 게시물 확인(기본3 -> 5). 인스타 1페이지=12개라
REM   5개까지는 호출 수 동일(공짜 안전마진). 글 몰리는 날 누락 방지. 12 초과 금지(2페이지=호출↑).
"C:\Users\myj87\AppData\Local\Programs\Python\Python314\python.exe" ingest.py --scan --max-accounts 80 --recent 5 > scan-log.txt 2>&1
exit /b %ERRORLEVEL%
