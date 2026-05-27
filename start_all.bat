@echo off
title SFL Bot Constructor — Launcher
color 0A
echo.
echo  ███████╗███████╗██╗      ██████╗  ██████╗ 
echo  ██╔════╝██╔════╝██║     ██╔═══██╗██╔════╝ 
echo  ███████╗█████╗  ██║     ██║   ██║██║      
echo  ╚════██║██╔══╝  ██║     ██║   ██║██║      
echo  ███████║██║     ███████╗╚██████╔╝╚██████╗ 
echo  ╚══════╝╚═╝     ╚══════╝ ╚═════╝  ╚═════╝ 
echo.
echo  Bot Constructor — Запуск всіх сервісів...
echo.

:: --- Запуск Backend (Express + WebSocket) ---
start "SF-Backend" cmd /k "cd /d D:\SF\backend && npm run dev"

:: Чекаємо 3 секунди щоб бекенд встиг стартувати
timeout /t 3 /nobreak >nul

:: --- Запуск Frontend (Vite) ---
start "SF-Frontend" cmd /k "cd /d D:\SF\frontend && npm run dev"

:: Чекаємо 2 секунди щоб фронтенд встиг стартувати
timeout /t 2 /nobreak >nul

:: --- Запуск Ngrok менеджера (з Telegram нотифікацією) ---
start "SF-Ngrok" cmd /k "cd /d D:\SF\backend && node ngrok_manager.js"

:: Чекаємо 2 секунди
timeout /t 2 /nobreak >nul

:: --- Запуск Telegram бота ---
start "SF-TelegramBot" cmd /k "cd /d D:\SF\backend && node telegram_bot.js"

echo.
echo  ✅ Всі сервіси запущено!
echo.
echo  Frontend:     http://localhost:5173
echo  Backend API:  http://localhost:3001
echo  Ngrok URL:    читається з backend\current_url.txt
echo.
echo  Після появи Ngrok URL — бот надішле посилання в Telegram
echo.
pause
