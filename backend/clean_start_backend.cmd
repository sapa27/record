@echo off
setlocal EnableExtensions DisableDelayedExpansion
cd /d "%~dp0"

if not exist ".env" (
  python generate_security_env.py --output .env
  if errorlevel 1 exit /b 1
)

for /f "tokens=1,* delims==" %%A in ('findstr /v /b /c:"#" ".env"') do (
  if not "%%A"=="" set "%%A=%%B"
)

if not defined MEETILY_BACKEND_TOKEN (
  echo MEETILY_BACKEND_TOKEN is not configured.
  exit /b 1
)
if not defined MEETILY_WHISPER_TOKEN (
  echo MEETILY_WHISPER_TOKEN is not configured.
  exit /b 1
)

set "PACKAGE_DIR=whisper-server-package"
set "MODEL_PATH=models\ggml-large-v3-turbo-q5_0.bin"
if defined WHISPER_MODEL set "MODEL_PATH=%WHISPER_MODEL:/=\%"
if not defined WHISPER_PORT set "WHISPER_PORT=8178"
if not defined WHISPER_LANGUAGE set "WHISPER_LANGUAGE=th"

if not exist "%PACKAGE_DIR%\whisper-server.exe" (
  echo Missing %PACKAGE_DIR%\whisper-server.exe. Run build_whisper.cmd first.
  exit /b 1
)
if not exist "%PACKAGE_DIR%\%MODEL_PATH%" (
  echo Missing Whisper model: %PACKAGE_DIR%\%MODEL_PATH%
  exit /b 1
)
if not exist "venv\Scripts\python.exe" (
  echo Missing Python virtual environment. Run build_whisper.cmd first.
  exit /b 1
)

start "Meetily Whisper" /b "%PACKAGE_DIR%\whisper-server.exe" --model "%PACKAGE_DIR%\%MODEL_PATH%" --host 127.0.0.1 --port %WHISPER_PORT% --language %WHISPER_LANGUAGE% --diarize --print-progress
start "Meetily Backend" /b "venv\Scripts\python.exe" "app\main.py"

echo Meetily local services started securely on 127.0.0.1. Tokens were not printed.
endlocal
