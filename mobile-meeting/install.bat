@echo off
cd /d %~dp0
echo Installing npm dependencies...
call npm install
echo.
echo Checking for node_modules...
if exist node_modules (
    echo SUCCESS: node_modules created
) else (
    echo FAILED: node_modules not found
)
pause
