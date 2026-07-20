@echo off
setlocal EnableExtensions DisableDelayedExpansion

set "ROOT=%~dp0.."
for %%I in ("%ROOT%") do set "ROOT=%%~fI"
cd /d "%ROOT%"

set "TARGET_TRIPLE="
set "VSROOT="
set "LIBCLANG_PATH_FOUND="

echo ============================================================
echo   Meetily Thai - Windows x64 Build Environment Check
echo ============================================================
echo.

if /I not "%PROCESSOR_ARCHITECTURE%"=="AMD64" if /I not "%PROCESSOR_ARCHITEW6432%"=="AMD64" (
  echo [ERROR] A 64-bit version of Windows is required.
  exit /b 10
)

call :require node.exe "Node.js LTS is not installed or is not in PATH."
if errorlevel 1 exit /b 11
call :require npm.cmd "npm is missing from the Node.js installation."
if errorlevel 1 exit /b 12
call :prepare_git
if errorlevel 1 exit /b 13
call :prepare_rust
if errorlevel 1 exit /b 14
call :prepare_cmake
if errorlevel 1 exit /b 17
call :require ffmpeg.exe "FFmpeg is not installed or ffmpeg.exe is not in PATH."
if errorlevel 1 exit /b 18

echo [OK] Required command-line programs were found.
node --version
cargo --version
rustc --version
cmake --version | findstr /R /C:"cmake version"
ffmpeg -version 2>nul | findstr /B /C:"ffmpeg version"
echo.

call :prepare_cmake
where cmake.exe >nul 2>&1
if not errorlevel 1 goto cmake_ready

call :refresh_cmake_path
where cmake.exe >nul 2>&1
if not errorlevel 1 goto cmake_ready

echo [ERROR] CMake is not installed or cmake.exe is not available in PATH.
echo CMake is required to compile the native audio and transcription components.
echo.
where winget.exe >nul 2>&1
if errorlevel 1 goto cmake_manual_install

echo WinGet is available and can install the official Kitware CMake package.
choice /C YN /N /M "Install CMake now? [Y/N]: "
if errorlevel 2 goto cmake_declined

echo.
echo [INFO] Installing CMake through WinGet...
winget install --id Kitware.CMake -e --source winget --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo [ERROR] WinGet could not install CMake.
  goto cmake_manual_install
)

call :refresh_cmake_path
where cmake.exe >nul 2>&1
if errorlevel 1 (
  echo [ERROR] CMake was installed, but this CMD process still cannot find cmake.exe.
  echo Close this window and run BUILD_WINDOWS_INSTALLER.cmd again.
  exit /b 1
)
goto cmake_ready

:refresh_cmake_path
if exist "%ProgramFiles%\CMake\bin\cmake.exe" set "PATH=%ProgramFiles%\CMake\bin;%PATH%"
if exist "%ProgramFiles(x86)%\CMake\bin\cmake.exe" set "PATH=%ProgramFiles(x86)%\CMake\bin;%PATH%"
if exist "%LocalAppData%\Programs\CMake\bin\cmake.exe" set "PATH=%LocalAppData%\Programs\CMake\bin;%PATH%"

rem Visual Studio may include a private CMake installation.
for /d %%D in ("%ProgramFiles%\Microsoft Visual Studio\2022\*") do if exist "%%~fD\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe" set "PATH=%%~fD\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin;%PATH%"
for /d %%D in ("%ProgramFiles(x86)%\Microsoft Visual Studio\2022\*") do if exist "%%~fD\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe" set "PATH=%%~fD\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin;%PATH%"
exit /b 0

:cmake_manual_install
echo.
echo Install the Windows x64 CMake installer from the official CMake website:
echo   https://cmake.org/download/
echo.
echo During setup, select the option to add CMake to PATH for all users
echo or for the current user. Then close this window and run the builder again.
echo.
echo You may also run this command when WinGet is available:
echo   winget install --id Kitware.CMake -e --source winget
echo.
exit /b 1

:cmake_declined
echo [ERROR] CMake installation was declined. The build cannot continue without CMake.
echo Run this command later, then restart the builder:
echo   winget install --id Kitware.CMake -e --source winget
exit /b 1

:cmake_ready
echo [OK] CMake is available.
cmake --version | findstr /R /C:"cmake version"
exit /b 0

:prepare_pnpm
if errorlevel 1 exit /b 19

call :prepare_msvc
if errorlevel 1 exit /b 20

call :prepare_llvm
if errorlevel 1 exit /b 21

for /f "tokens=2" %%I in ('rustc -vV ^| findstr /B "host:"') do set "TARGET_TRIPLE=%%I"
if not defined TARGET_TRIPLE (
  echo [ERROR] The Rust host target could not be detected.
  exit /b 22
)

echo %TARGET_TRIPLE% | findstr /I /C:"x86_64-pc-windows-msvc" >nul
if errorlevel 1 (
  echo [ERROR] Rust is not using the Windows x64 MSVC toolchain.
  echo Current Rust host: %TARGET_TRIPLE%
  echo.
  echo Run these commands and start the builder again:
  echo   rustup toolchain install stable-x86_64-pc-windows-msvc
  echo   rustup default stable-x86_64-pc-windows-msvc
  exit /b 23
)

echo [OK] Rust target: %TARGET_TRIPLE%
echo [OK] LIBCLANG_PATH: %LIBCLANG_PATH%
echo.

echo [1/4] Installing locked frontend dependencies...
pushd "%ROOT%\frontend"
call pnpm install --frozen-lockfile
set "STEP_CODE=%ERRORLEVEL%"
popd
if not "%STEP_CODE%"=="0" (
  echo [ERROR] pnpm install failed with exit code %STEP_CODE%.
  exit /b 31
)

echo.
echo [2/4] Building the CPU-only llama-helper sidecar...
call cargo build --release -p llama-helper --locked
if errorlevel 1 (
  echo [ERROR] llama-helper compilation failed.
  exit /b 32
)

if not exist "%ROOT%\target\release\llama-helper.exe" (
  echo [ERROR] target\release\llama-helper.exe was not created.
  exit /b 33
)

if not exist "%ROOT%\frontend\src-tauri\binaries" mkdir "%ROOT%\frontend\src-tauri\binaries"
copy /Y "%ROOT%\target\release\llama-helper.exe" "%ROOT%\frontend\src-tauri\binaries\llama-helper-%TARGET_TRIPLE%.exe" >nul
if errorlevel 1 (
  echo [ERROR] The llama-helper sidecar could not be copied.
  exit /b 34
)

echo.
echo [3/4] Checking TypeScript...
pushd "%ROOT%\frontend"
call pnpm exec tsc --noEmit
set "STEP_CODE=%ERRORLEVEL%"
popd
if not "%STEP_CODE%"=="0" (
  echo [ERROR] TypeScript validation failed.
  exit /b 35
)

echo.
echo [4/4] Building the Windows NSIS installer...
pushd "%ROOT%\frontend"
call pnpm run tauri:build:cpu
set "STEP_CODE=%ERRORLEVEL%"
popd
if not "%STEP_CODE%"=="0" (
  echo [ERROR] Tauri/NSIS build failed with exit code %STEP_CODE%.
  exit /b 36
)

echo.
if not exist "%ROOT%\target\release\bundle\nsis\*.exe" (
  echo [ERROR] The build finished but no NSIS installer was found.
  exit /b 37
)

echo ============================================================
echo BUILD SUCCESSFUL
for %%F in ("%ROOT%\target\release\bundle\nsis\*.exe") do echo Installer: %%~fF
echo ============================================================
exit /b 0

:require
where %~1 >nul 2>&1
if errorlevel 1 (
  echo [ERROR] %~2
  echo Missing command: %~1
  echo.
  exit /b 1
)
exit /b 0

:prepare_git
where git.exe >nul 2>&1
if not errorlevel 1 goto git_ready

rem Git may already be installed but its folder may not be in PATH.
if exist "%ProgramFiles%\Git\cmd\git.exe" set "PATH=%ProgramFiles%\Git\cmd;%PATH%"
where git.exe >nul 2>&1
if not errorlevel 1 goto git_ready

if exist "%ProgramFiles%\Git\bin\git.exe" set "PATH=%ProgramFiles%\Git\bin;%PATH%"
where git.exe >nul 2>&1
if not errorlevel 1 goto git_ready

if exist "%ProgramFiles(x86)%\Git\cmd\git.exe" set "PATH=%ProgramFiles(x86)%\Git\cmd;%PATH%"
where git.exe >nul 2>&1
if not errorlevel 1 goto git_ready

if exist "%LocalAppData%\Programs\Git\cmd\git.exe" set "PATH=%LocalAppData%\Programs\Git\cmd;%PATH%"
where git.exe >nul 2>&1
if not errorlevel 1 goto git_ready

echo [ERROR] Git for Windows is not installed or is not available in PATH.
echo Git is required because this project has locked Rust dependencies from Git repositories.
echo.
where winget.exe >nul 2>&1
if errorlevel 1 goto git_manual_install

echo WinGet is available and can install the official Git for Windows package.
choice /C YN /N /M "Install Git for Windows now? [Y/N]: "
if errorlevel 2 goto git_declined

echo.
echo [INFO] Installing Git for Windows through WinGet...
winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo [ERROR] WinGet could not install Git for Windows.
  echo Install it manually, then close and reopen this builder.
  goto git_manual_install
)

rem Refresh Git for this CMD process without requiring a Windows restart.
if exist "%ProgramFiles%\Git\cmd\git.exe" set "PATH=%ProgramFiles%\Git\cmd;%PATH%"
if exist "%ProgramFiles%\Git\bin\git.exe" set "PATH=%ProgramFiles%\Git\bin;%PATH%"
if exist "%ProgramFiles(x86)%\Git\cmd\git.exe" set "PATH=%ProgramFiles(x86)%\Git\cmd;%PATH%"
if exist "%LocalAppData%\Programs\Git\cmd\git.exe" set "PATH=%LocalAppData%\Programs\Git\cmd;%PATH%"
where git.exe >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Git was installed, but this CMD process still cannot find git.exe.
  echo Close this window and run BUILD_WINDOWS_INSTALLER.cmd again.
  exit /b 1
)
goto git_ready

:git_manual_install
echo.
echo Install Git for Windows from:
echo   https://git-scm.com/install/windows
echo.
echo Or open Command Prompt as Administrator and run:
echo   winget install --id Git.Git -e --source winget
echo.
echo During setup, keep the option that adds Git to the command line and PATH.
echo After installation, close this window and run the builder again.
exit /b 1

:git_declined
echo [ERROR] Git installation was declined. The build cannot continue without Git.
echo Run this command later, then restart the builder:
echo   winget install --id Git.Git -e --source winget
exit /b 1

:git_ready
echo [OK] Git for Windows is available.
git --version
exit /b 0

:prepare_rust
rem Rustup installs Cargo, rustc and rustup under the current user's .cargo\bin folder.
if exist "%USERPROFILE%\.cargo\bin\cargo.exe" set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"

where cargo.exe >nul 2>&1
if not errorlevel 1 goto rust_verify

where winget.exe >nul 2>&1
if errorlevel 1 goto rust_manual_install

echo [ERROR] Rust/Cargo is not installed or is not available in PATH.
echo Rustup can install the required Windows x64 MSVC toolchain.
echo.
choice /C YN /N /M "Install Rustup now? [Y/N]: "
if errorlevel 2 goto rust_declined

echo.
echo [INFO] Installing Rustup through WinGet...
winget install --id Rustlang.Rustup -e --source winget --accept-package-agreements --accept-source-agreements
if errorlevel 1 (
  echo [ERROR] WinGet could not install Rustup.
  goto rust_manual_install
)

rem Refresh Rust tools for this CMD process without requiring a Windows restart.
if exist "%USERPROFILE%\.cargo\bin\cargo.exe" set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
where cargo.exe >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Rustup was installed, but this CMD process still cannot find cargo.exe.
  echo Close this window and run BUILD_WINDOWS_INSTALLER.cmd again.
  exit /b 1
)

:rust_verify
where cargo.exe >nul 2>&1
if errorlevel 1 (
  echo [ERROR] cargo.exe is missing from the Rust installation.
  exit /b 1
)
where rustc.exe >nul 2>&1
if errorlevel 1 (
  echo [ERROR] rustc.exe is missing from the Rust installation.
  exit /b 1
)
where rustup.exe >nul 2>&1
if errorlevel 1 (
  echo [ERROR] rustup.exe is missing. This build requires a Rustup-managed toolchain.
  exit /b 1
)

echo [OK] Rustup is available.
rustup --version

rustup toolchain list | findstr /I /C:"stable-x86_64-pc-windows-msvc" >nul
if errorlevel 1 (
  echo [INFO] Installing stable Windows x64 MSVC Rust toolchain...
  call rustup toolchain install stable-x86_64-pc-windows-msvc --profile minimal
  if errorlevel 1 (
    echo [ERROR] Rustup could not install stable-x86_64-pc-windows-msvc.
    exit /b 1
  )
)

call rustup default stable-x86_64-pc-windows-msvc
if errorlevel 1 (
  echo [ERROR] Rustup could not select the Windows x64 MSVC toolchain.
  exit /b 1
)

echo [OK] Rust/Cargo Windows MSVC toolchain is ready.
exit /b 0

:rust_manual_install
echo.
echo Install Rustup from the official Rust installation page.
echo After installation, close this window and run the builder again.
echo Expected tool folder:
echo   %USERPROFILE%\.cargo\bin
echo.
echo You may also run this command when WinGet is available:
echo   winget install --id Rustlang.Rustup -e --source winget
echo.
exit /b 1

:rust_declined
echo [ERROR] Rustup installation was declined. The build cannot continue without Rust/Cargo.
echo Run this command later, then restart the builder:
echo   winget install --id Rustlang.Rustup -e --source winget
exit /b 1

:prepare_pnpm
where pnpm.cmd >nul 2>&1
if not errorlevel 1 (
  echo [OK] pnpm is available.
  exit /b 0
)

echo [INFO] pnpm was not found. Trying Corepack...
where corepack.cmd >nul 2>&1
if errorlevel 1 (
  echo [ERROR] pnpm and Corepack are both missing.
  echo Reinstall Node.js LTS with Corepack, or run:
  echo   npm install --global pnpm@9.15.4
  exit /b 1
)

call corepack enable
if errorlevel 1 (
  echo [ERROR] Corepack could not be enabled.
  echo Open Command Prompt as Administrator once, then run:
  echo   corepack enable
  exit /b 1
)
call corepack prepare pnpm@9.15.4 --activate
if errorlevel 1 (
  echo [ERROR] Corepack could not activate pnpm 9.15.4.
  exit /b 1
)
where pnpm.cmd >nul 2>&1
if errorlevel 1 (
  echo [ERROR] pnpm is still unavailable after Corepack activation.
  exit /b 1
)
echo [OK] pnpm 9.15.4 is active.
exit /b 0

:prepare_msvc
where cl.exe >nul 2>&1
if not errorlevel 1 (
  echo [OK] Microsoft C++ compiler is already active.
  exit /b 0
)

set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
if not exist "%VSWHERE%" (
  echo [ERROR] Visual Studio Build Tools were not found.
  echo Install Visual Studio Build Tools 2022 and select:
  echo   Desktop development with C++
  echo   MSVC v143 x64/x86 build tools
  echo   Windows 10 or Windows 11 SDK
  exit /b 1
)

set "VSROOT_FILE=%TEMP%\meetily_vsroot_%RANDOM%.txt"
"%VSWHERE%" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath > "%VSROOT_FILE%"
set /p VSROOT=<"%VSROOT_FILE%"
del /Q "%VSROOT_FILE%" >nul 2>&1

if not defined VSROOT (
  echo [ERROR] Visual Studio is installed, but the C++ x64 workload is missing.
  echo Open Visual Studio Installer and add Desktop development with C++.
  exit /b 1
)

if not exist "%VSROOT%\Common7\Tools\VsDevCmd.bat" (
  echo [ERROR] VsDevCmd.bat was not found under:
  echo   %VSROOT%
  exit /b 1
)

call "%VSROOT%\Common7\Tools\VsDevCmd.bat" -arch=x64 -host_arch=x64 >nul
where cl.exe >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Microsoft C++ compiler could not be activated.
  exit /b 1
)
echo [OK] Microsoft C++ Build Tools x64 are active.
exit /b 0

:prepare_llvm
if defined LIBCLANG_PATH if exist "%LIBCLANG_PATH%\libclang.dll" (
  echo [OK] Existing LIBCLANG_PATH is valid.
  exit /b 0
)

if exist "%ProgramFiles%\LLVM\bin\libclang.dll" set "LIBCLANG_PATH_FOUND=%ProgramFiles%\LLVM\bin"
if not defined LIBCLANG_PATH_FOUND if exist "%ProgramFiles(x86)%\LLVM\bin\libclang.dll" set "LIBCLANG_PATH_FOUND=%ProgramFiles(x86)%\LLVM\bin"
if not defined LIBCLANG_PATH_FOUND if defined VSROOT if exist "%VSROOT%\VC\Tools\Llvm\x64\bin\libclang.dll" set "LIBCLANG_PATH_FOUND=%VSROOT%\VC\Tools\Llvm\x64\bin"
if not defined LIBCLANG_PATH_FOUND if defined VSROOT if exist "%VSROOT%\VC\Tools\Llvm\bin\libclang.dll" set "LIBCLANG_PATH_FOUND=%VSROOT%\VC\Tools\Llvm\bin"

if not defined LIBCLANG_PATH_FOUND (
  echo [ERROR] libclang.dll was not found.
  echo Install LLVM for Windows, or add the Visual Studio LLVM/Clang component.
  echo Expected common location:
  echo   C:\Program Files\LLVM\bin\libclang.dll
  exit /b 1
)

set "LIBCLANG_PATH=%LIBCLANG_PATH_FOUND%"
echo [OK] LLVM/Clang was found.
exit /b 0
