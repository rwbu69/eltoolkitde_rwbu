@echo off
setlocal EnableExtensions

REM Launcher untuk MediaToolkit.ps1
REM - Double-click friendly (tidak langsung nutup)
REM - Pakai pwsh (PowerShell 7) jika ada, fallback ke powershell
REM - Bypass ExecutionPolicy

REM Jika dibuka via Explorer biasanya pakai cmd /c, jadi window bisa cepat nutup.
REM Re-launch diri sendiri pakai cmd /k agar window tetap terbuka.
if /i "%~1"=="--no-relaunch" goto :START
echo %cmdcmdline% | findstr /i " /c " >nul 2>&1
if errorlevel 1 goto :START
echo %cmdcmdline% | findstr /i " /k " >nul 2>&1
if not errorlevel 1 goto :START
cmd.exe /k ""%~f0" --no-relaunch"
exit /b

:START
set "SCRIPT_DIR=%~dp0"
set "PS1=%SCRIPT_DIR%ElToolkitDeRWBU.ps1"

echo.
echo [Launcher] Folder  : %SCRIPT_DIR%
echo [Launcher] Script  : %PS1%
echo.

if not exist "%PS1%" goto :NO_PS1

pushd "%SCRIPT_DIR%" >nul
if errorlevel 1 goto :PUSHD_FAIL

where pwsh >nul 2>&1
if not errorlevel 1 goto :RUN_PWSH

where powershell >nul 2>&1
if not errorlevel 1 goto :RUN_WINPS

goto :NO_PS

:RUN_PWSH
echo [Launcher] Menggunakan: pwsh
pwsh -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
set "EXITCODE=%errorlevel%"
goto :DONE

:RUN_WINPS
echo [Launcher] Menggunakan: powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "%PS1%"
set "EXITCODE=%errorlevel%"
goto :DONE

:DONE
popd >nul
if not "%EXITCODE%"=="0" goto :FAILED
exit /b %EXITCODE%

:FAILED
echo.
echo Toolkit selesai dengan exit code: %EXITCODE%
pause
exit /b %EXITCODE%

:NO_PS1
echo ERROR: Tidak menemukan MediaToolkit.ps1 di:
echo %PS1%
pause
exit /b 1

:NO_PS
echo ERROR: PowerShell tidak ditemukan (pwsh/powershell).
popd >nul
pause
exit /b 1

:PUSHD_FAIL
echo ERROR: Gagal masuk ke folder script:
echo %SCRIPT_DIR%
pause
exit /b 1
