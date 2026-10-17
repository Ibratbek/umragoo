@echo off
cd /d "%~dp0"
echo Umragoo lokal server
echo   Sayt:        http://127.0.0.1:8080/
echo   Admin panel: http://127.0.0.1:8080/admin/
echo   To'xtatish:  Ctrl+C
start "" http://127.0.0.1:8080/
python server.py
pause
