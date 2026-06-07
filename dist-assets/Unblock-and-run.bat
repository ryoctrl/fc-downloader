@echo off
REM ============================================================================
REM  fc-downloader - Unblock and launch helper (for the UNSIGNED portable build)
REM
REM  Windows tags files downloaded from the internet with a "Mark of the Web",
REM  which makes SmartScreen show "Windows protected your PC" for unsigned apps.
REM  This removes that mark from the files in THIS folder and launches the
REM  portable build, so you don't get the warning.
REM
REM  Put this .bat in the same folder as fc-downloader-<version>-portable.exe,
REM  then double-click it.
REM
REM  NOTE: This does NOT bypass Smart App Control (SAC). If SAC is enabled it
REM  will still block unsigned apps - turn SAC off (Windows Security > App &
REM  browser control > Smart App Control) or use a code-signed build.
REM ============================================================================
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo Unblocking downloaded files in this folder...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -LiteralPath '%~dp0' -File | Unblock-File"

set "EXE="
for %%f in ("fc-downloader-*portable*.exe") do set "EXE=%%f"
if defined EXE (
  echo Launching "!EXE!" ...
  start "" "!EXE!"
) else (
  echo.
  echo Portable exe not found here. Files are unblocked - run the app manually.
  pause
)
endlocal
