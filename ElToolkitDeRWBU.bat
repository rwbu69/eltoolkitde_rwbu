@echo off
setlocal EnableExtensions

REM Launcher untuk ElToolkitDeRWBU
REM - Double-click friendly (tidak langsung nutup)

if /i "%~1"=="--no-relaunch" goto :START
echo %cmdcmdline% | findstr /i " /c " >nul 2>&1
if errorlevel 1 goto :START
echo %cmdcmdline% | findstr /i " /k " >nul 2>&1
if not errorlevel 1 goto :START
cmd.exe /k ""%~f0" --no-relaunch"
exit /b

:START
set "SCRIPT_DIR=%~dp0"
cd /d "%SCRIPT_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -File "LauncherMenu.ps1"
if %errorlevel% neq 0 (
    echo.
    echo Aplikasi berhenti dengan error code %errorlevel%.
)

pause
