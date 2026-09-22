@echo off
chcp 65001 >nul
echo Зупинка служби Cloudflared на цьому комп'ютері...
net stop Cloudflared
sc config Cloudflared start= demand
echo.
echo ========================================================
echo Службу Cloudflared успішно зупинено!
echo Тепер весь трафік іде автономно через сервер CasaOS.
echo ========================================================
pause
