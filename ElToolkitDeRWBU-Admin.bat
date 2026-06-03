@echo off
setlocal EnableExtensions

REM Launcher Admin untuk ElToolkitDeRWBU.ps1
REM - Meminta UAC (Run as Administrator)
REM - Pakai pwsh (PowerShell 7) jika ada, fallback ke powershell
REM - Bypass ExecutionPolicy

set "SCRIPT_DIR=%~dp0"
set "PS1=%SCRIPT_DIR%ElToolkitDeRWBU.ps1"

echo.
echo [Launcher-Admin] Folder : %SCRIPT_DIR%
echo [Launcher-Admin] Script : %PS1%
echo.

if not exist "%PS1%" goto :NO_PS1

REM Tentukan executable PowerShell yang akan dielevasi
set "PSEXE=powershell.exe"
where pwsh >nul 2>&1
if not errorlevel 1 set "PSEXE=pwsh.exe"

REM Jalankan proses baru dengan hak Administrator
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%PSEXE%' -Verb RunAs -WorkingDirectory '%SCRIPT_DIR%' -ArgumentList @('-NoProfile','-ExecutionPolicy','Bypass','-File','%PS1%')"

REM Selesai (proses utama berjalan di jendela admin)
exit /b %errorlevel%

:NO_PS1
echo ERROR: Tidak menemukan ElToolkitDeRWBU.ps1 di:
echo %PS1%
pause
exit /b 1
