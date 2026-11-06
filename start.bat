@echo off
rem rootshell starten: Doppelklick genuegt. Das schwarze Fenster offen lassen, solange du lernst.
cd /d "%~dp0"
title rootshell (Fenster offen lassen - schliessen beendet die App)
where node >nul 2>nul || (echo Node.js fehlt - bitte von https://nodejs.org installieren. & pause & exit /b 1)

rem Laeuft die App schon? Dann nur den Browser oeffnen.
powershell -NoProfile -Command "try { (New-Object Net.Sockets.TcpClient('127.0.0.1', 8086)).Close(); exit 0 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 (
  echo rootshell laeuft bereits - oeffne den Browser ...
  start "" http://localhost:8086
  exit /b 0
)

if not exist node_modules\ssh2 (
  echo Installiere Abhaengigkeiten ^(einmalig^) ...
  call npm install --no-audit --no-fund
)

rem Browser oeffnen, sobald der Server antwortet
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "for ($i = 0; $i -lt 40; $i++) { try { (New-Object Net.Sockets.TcpClient('127.0.0.1', 8086)).Close(); Start-Process 'http://localhost:8086'; break } catch { Start-Sleep -Milliseconds 250 } }"
node server.js
pause
