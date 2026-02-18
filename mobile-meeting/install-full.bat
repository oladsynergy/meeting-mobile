@echo off
cd /d %~dp0
echo Installing npm dependencies...
echo This will take 5-10 minutes, please wait...
echo.
call npm install --verbose >install-log.txt 2>&1
echo.
if %ERRORLEVEL% EQU 0 (
    echo SUCCESS: Installation complete
) else (
    echo FAILED: Check install-log.txt for details
)
echo.
type install-log.txt | findstr /C:"added" /C:"up to date" /C:"npm ERR"
pause
