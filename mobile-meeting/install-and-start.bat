@echo off
cd /d %~dp0
echo Installing @react-navigation/native-stack...
call npm install @react-navigation/native-stack --save
echo.
echo Starting Expo Web Server...
call npx expo start --web --port 19006
pause
