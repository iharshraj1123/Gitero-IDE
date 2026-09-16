@echo off
setlocal enabledelayedexpansion

:: ============================================================================
:: Gitero IDE Terminal Launcher (gcode)
:: Allows launching Gitero IDE from any terminal, command prompt, or PowerShell
:: Usage:
::   gcode .             -> Open current folder in Gitero IDE
::   gcode <folder>      -> Open target folder in Gitero IDE
::   gcode <file>        -> Open specific file in Gitero IDE
::   gcode               -> Launch Gitero IDE
:: ============================================================================

:: 1. Search for Gitero.exe binary
set "GITERO_EXE="

:: Check installed app location beside bin directory
if exist "%~dp0..\Gitero.exe" (
  set "GITERO_EXE=%~dp0..\Gitero.exe"
)

:: Check per-user installation directory in Local AppData
if not defined GITERO_EXE (
  if exist "%LOCALAPPDATA%\Programs\Gitero IDE\Gitero.exe" (
    set "GITERO_EXE=%LOCALAPPDATA%\Programs\Gitero IDE\Gitero.exe"
  )
)

:: Check local development / repository build location
if not defined GITERO_EXE (
  if exist "%~dp0..\dist\gitero\gitero-win_x64.exe" (
    set "GITERO_EXE=%~dp0..\dist\gitero\gitero-win_x64.exe"
  )
)

if not defined GITERO_EXE (
  echo [Gitero] Error: Gitero.exe executable could not be found.
  echo Please verify that Gitero IDE is installed in %%LOCALAPPDATA%%\Programs\Gitero IDE.
  exit /b 1
)

:: 2. Resolve target argument and launch
if "%~1"=="" (
  start "" "!GITERO_EXE!"
) else if "%~1"=="." (
  start "" "!GITERO_EXE!" "%CD%"
) else (
  start "" "!GITERO_EXE!" "%~f1"
)

endlocal
