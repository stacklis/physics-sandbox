@echo off
title physics-sandbox - static :8081
cd /d "%~dp0"
echo ================================================
echo  physics-sandbox (static HTML) ^=^> http://localhost:8081
echo  Bound to 0.0.0.0 - reachable via LAN / Tailscale
echo  Serves index.html from this folder.
echo  (android-app subfolder is the Capacitor wrapper, not served)
echo ================================================
echo.
python -m http.server 8081 --bind 0.0.0.0
echo.
echo Server stopped. Press any key to close.
pause >nul
