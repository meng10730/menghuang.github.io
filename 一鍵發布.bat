@echo off
chcp 65001 >nul
echo =========================================
echo      吃墨水的晚餐 - 一鍵發布腳本
echo =========================================
echo.
echo 正在掃描變更的檔案...
git add .
git status -s

echo.
set /p msg="請輸入這次修改的簡短說明 (直接按 Enter 預設為 '更新網站內容'): "
if "%msg%"=="" set msg=更新網站內容

echo.
echo [1/2] 正在儲存變更 (Commit)...
git commit -m "%msg%"

echo.
echo [2/2] 正在上傳至 GitHub (Push)...
git push

echo.
echo =========================================
echo  發布成功！程式碼已推送到 GitHub。
echo  GitHub Actions 正在自動為您更新網站。
echo  大約 1~2 分鐘後，即可重新整理網頁查看成果！
echo =========================================
echo.
pause
