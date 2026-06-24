@echo off
chcp 65001 > nul

echo ==========================================
echo    Changshengjie Novel Sync System
echo ==========================================
echo.
echo Running sync script, please wait...
node scripts/sync-novels.js
if %errorlevel% equ 0 goto SYNC_SUCCESS

echo.
echo [Error] Sync failed! Please check the error messages above.
echo.
pause
exit /b 1

:SYNC_SUCCESS
echo.
echo [Success] Sync completed successfully!
echo.
pause
