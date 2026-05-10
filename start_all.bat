@echo off
title SF Bot Manager
echo 🚀 Запуск Sunflower Land Bot Constructor...
echo ------------------------------------------

cd /d "d:\SF\backend"

:: Очищаємо старі процеси про всяк випадок
taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM ngrok.exe /T >nul 2>&1

echo 🎨 Запуск Фронтенду...
start "SF-Frontend" cmd /k "cd /d d:\SF\frontend && npm run dev"

echo 📡 Запуск Бекенда...
start "SF-Backend" cmd /k "cd /d d:\SF\backend && npm run dev"

echo 🔑 Запуск Менеджера Токенів...
start "SF-Ngrok-Manager" cmd /k "cd /d d:\SF\backend && node ngrok_manager.js"

echo ------------------------------------------
echo ✅ УСЕ ЗАПУЩЕНО!
echo 🤖 Тепер можете заходити в Telegram.
echo 💡 Для вимкнення просто закрийте два вікна консолі, що відкрилися.
echo ------------------------------------------
pause
