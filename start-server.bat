@echo off
cd /d "%~dp0"
echo Umragoo lokal server: http://127.0.0.1:8080/
start "" http://127.0.0.1:8080/
python -m http.server 8080 --bind 127.0.0.1
