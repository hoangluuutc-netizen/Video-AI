@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Dang khoi dong Doi Lam Video A.I. tai http://localhost:4173 ...
start "" http://localhost:4173
node scripts/dashboard-server.mjs
pause
