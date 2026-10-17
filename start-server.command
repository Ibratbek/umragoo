#!/bin/sh
# Umragoo — macOS uchun ishga tushirish (Finder'da ikki marta bosing)
cd "$(dirname "$0")" || exit 1
echo "Umragoo lokal server"
echo "  Sayt:        http://127.0.0.1:8080/"
echo "  Admin panel: http://127.0.0.1:8080/admin/"
echo "  To'xtatish:  Ctrl+C"
(sleep 1; open "http://127.0.0.1:8080/") &
exec python3 server.py
