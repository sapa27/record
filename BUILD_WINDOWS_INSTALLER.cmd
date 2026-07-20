@echo off
setlocal EnableExtensions DisableDelayedExpansion
title Meetily Thai - Windows Installer Builder
cd /d "%~dp0"

echo ============================================================
echo   Meetily Thai 0.4.1-r4 - Windows Installer Builder
echo ============================================================
echo.
echo Project folder: %CD%
echo.

if not exist "%~dp0frontend\build-windows.cmd" (
  echo [ERROR] The project files were not found.
  echo.
  echo Do not run this file from inside the ZIP preview window.
  echo Right-click the ZIP file, choose Extract All, and then run
  echo BUILD_WINDOWS_INSTALLER.cmd from the extracted folder.
  echo.
  pause
  exit /b 2
)

if not exist "%~dp0Cargo.toml" (
  echo [ERROR] Cargo.toml is missing. The ZIP may not be fully extracted.
  echo.
  pause
  exit /b 2
)

if not exist "%~dp0frontend\package.json" (
  echo [ERROR] frontend\package.json is missing. The ZIP may be incomplete.
  echo.
  pause
  exit /b 2
)

echo Starting environment checks and installer build...
echo The first build requires an Internet connection for dependencies.
echo.

call "%~dp0frontend\build-windows.cmd"
set "BUILD_EXIT_CODE=%ERRORLEVEL%"

echo.
echo ============================================================
if "%BUILD_EXIT_CODE%"=="0" (
  echo BUILD COMPLETED SUCCESSFULLY
  echo Installer folder:
  echo   %~dp0target\release\bundle\nsis
) else (
  echo BUILD FAILED - EXIT CODE %BUILD_EXIT_CODE%
  echo.
  echo Read the first [ERROR] message above. It identifies the missing
  echo program or the build step that failed.
  echo.
  if "%BUILD_EXIT_CODE%"=="13" (
    echo Git installation help:
    echo   winget install --id Git.Git -e --source winget
    echo   Then close this window and run the builder again.
    echo.
  )
  if "%BUILD_EXIT_CODE%"=="14" (
    echo Rust installation help:
    echo   winget install --id Rustlang.Rustup -e --source winget
    echo   Then close this window and run the builder again.
    echo.
  )
  if "%BUILD_EXIT_CODE%"=="17" (
    echo CMake installation help:
    echo   winget install --id Kitware.CMake -e --source winget
    echo   Then close this window and run the builder again.
    echo.
  )
  echo Recommended extraction folder:
  echo   C:\MeetilyThai
)
echo ============================================================
echo.
pause
exit /b %BUILD_EXIT_CODE%
