@echo off
chcp 65001 > nul
echo ====================================================
echo   Starting Keystatic CMS ...
echo ====================================================
echo.
echo   [Info] Opening http://localhost:4321/keystatic
echo   [Info] Press Ctrl+C in this window to stop.
echo.

start http://localhost:4321/keystatic
npm run dev
