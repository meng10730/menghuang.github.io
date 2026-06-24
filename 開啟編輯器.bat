@echo off
echo ====================================================
echo   正在啟動內容管理後台 (Keystatic) ...
echo ====================================================
echo.
echo 【提示】請在瀏覽器中開啟： http://localhost:4321/keystatic
echo.
echo 若要結束編輯，請關閉此視窗或按下 Ctrl+C。
echo.

start http://localhost:4321/keystatic
npm run dev
