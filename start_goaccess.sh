#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "Перезапуск frontend з увімкненим логуванням та запуск GoAccess..."
docker compose up -d frontend goaccess

echo "=========================================================="
echo "GoAccess успішно запущено!"
echo "Веб-панель статистики: http://$(hostname -I | awk '{print $1}'):7880"
echo "=========================================================="
