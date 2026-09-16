@echo off
setlocal enabledelayedexpansion

echo [Gitero] Compiling Gitero Explorer Hotkey companion...

set "CSC_EXE=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC_EXE%" (
    set "CSC_EXE=C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe"
)

if not exist "%CSC_EXE%" (
    echo [Gitero] Error: C# compiler csc.exe not found.
    exit /b 1
)

set "OUT_DIR=%~dp0..\..\bin"
if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"
set "OUT_EXE=%OUT_DIR%\gitero_explorer_hotkey.exe"
set "ALIAS_EXE=%OUT_DIR%\glitero_explorer_hotkey.exe"

"%CSC_EXE%" /target:winexe /platform:x64 /optimize+ /r:System.Windows.Forms.dll /r:Microsoft.CSharp.dll /out:"%OUT_EXE%" "%~dp0Program.cs"

if %ERRORLEVEL% equ 0 (
    copy /y "%OUT_EXE%" "%ALIAS_EXE%" >nul
    echo [Gitero] Successfully compiled: %OUT_EXE%
    echo [Gitero] Successfully generated alias: %ALIAS_EXE%
    exit /b 0
) else (
    echo [Gitero] Compilation failed with error code %ERRORLEVEL%.
    exit /b %ERRORLEVEL%
)
