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
if not defined MEETILY_WHISPER_TOKEN (
  echo MEETILY_WHISPER_TOKEN is not configured.
  exit /b 1
)

set "PACKAGE_DIR=whisper-server-package"
set "MODEL_NAME=ggml-large-v3-turbo-q5_0.bin"
if not "%~1"=="" set "MODEL_NAME=ggml-%~1.bin"
if not exist "%PACKAGE_DIR%\whisper-server.exe" (
  echo Missing Whisper server binary. Run build_whisper.cmd first.
  exit /b 1
)
if not exist "%PACKAGE_DIR%\models\%MODEL_NAME%" (
  echo Missing model: %PACKAGE_DIR%\models\%MODEL_NAME%
  exit /b 1
)

echo Starting authenticated Whisper server on 127.0.0.1:8178. Token is not printed.
"%PACKAGE_DIR%\whisper-server.exe" --model "%PACKAGE_DIR%\models\%MODEL_NAME%" --host 127.0.0.1 --port 8178 --language th --diarize --print-progress
endlocal
