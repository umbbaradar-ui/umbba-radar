@echo off
REM 작업 스케줄러용 래퍼 - 한글 경로 회피(작업 디렉터리는 스케줄러 "시작 위치"로 지정)
REM 이 .bat 은 순수 ASCII 만 포함 → cmd 코드페이지 무관하게 안전
chcp 65001 > nul
set PYTHONUTF8=1
REM --max-accounts 1000: 활성 계정(현재 202개) 전부 하루 1회 스캔. 중복 URL은 서버에서 자동 제거.
"C:\Users\myj87\AppData\Local\Programs\Python\Python314\python.exe" ingest.py --scan --max-accounts 1000 > scan-log.txt 2>&1
exit /b %ERRORLEVEL%
