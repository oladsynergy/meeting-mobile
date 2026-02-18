@echo off
cd /d %~dp0
echo Starting Expo Web Server on port 19006...
echo.
call npx expo start --web --port 19006
echo.
echo Server stopped.
pause
