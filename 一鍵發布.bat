@echo off
chcp 65001 > nul
echo =========================================
echo      One-Click Publish Script
echo =========================================
echo.
echo Scanning for changed files...
git add .
git status -s

echo.
set /p msg="Enter a short commit message (Press Enter for 'Update content'): "
if "%msg%"=="" set msg=Update content

echo.
echo [1/2] Saving changes (Commit)...
git commit -m "%msg%"

echo.
echo [2/2] Uploading to GitHub (Push)...
git push

echo.
echo =========================================
echo  Publish successful! Code pushed to GitHub.
echo  GitHub Actions will update your site automatically.
echo  Please wait 1-2 minutes and refresh your webpage.
echo =========================================
echo.
pause
