@echo off
cd /d %~dp0
echo Cleaning node_modules...
if exist node_modules (
    echo Deleting old node_modules...
    rmdir /s /q node_modules
)
echo.
echo Installing fresh dependencies...
call npm install
echo.
echo Done!
pause
