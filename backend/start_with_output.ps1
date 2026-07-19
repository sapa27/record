$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$envFile = Join-Path $PSScriptRoot '.env'
if (-not (Test-Path $envFile)) {
    & python (Join-Path $PSScriptRoot 'generate_security_env.py') --output $envFile
    if ($LASTEXITCODE -ne 0) { throw 'Unable to generate protected local-service tokens.' }
}

Get-Content $envFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith('#')) {
        $parts = $line.Split('=', 2)
        if ($parts.Count -eq 2) {
            [Environment]::SetEnvironmentVariable($parts[0], $parts[1], 'Process')
        }
    }
}

if (($env:MEETILY_BACKEND_TOKEN.Length -lt 32) -or ($env:MEETILY_WHISPER_TOKEN.Length -lt 32)) {
    throw 'Security tokens are missing or too short. Regenerate backend/.env.'
}

$packageDir = Join-Path $PSScriptRoot 'whisper-server-package'
$whisperExe = Join-Path $packageDir 'whisper-server.exe'
$modelPath = Join-Path $packageDir 'models\ggml-large-v3-turbo-q5_0.bin'
$pythonExe = Join-Path $PSScriptRoot 'venv\Scripts\python.exe'
$backendApp = Join-Path $PSScriptRoot 'app\main.py'

if (-not (Test-Path $whisperExe)) { throw 'Whisper server binary is missing. Run build_whisper.cmd first.' }
if (-not (Test-Path $modelPath)) { throw 'The multilingual Thai Whisper model is missing.' }
if (-not (Test-Path $pythonExe)) { throw 'Python virtual environment is missing.' }

Write-Host 'Starting authenticated local services on 127.0.0.1. Tokens are not printed.'
$whisper = Start-Process -FilePath $whisperExe -ArgumentList @(
    '--model', $modelPath,
    '--host', '127.0.0.1',
    '--port', '8178',
    '--language', 'th',
    '--diarize',
    '--print-progress'
) -PassThru -NoNewWindow

$backend = Start-Process -FilePath $pythonExe -ArgumentList @($backendApp) -PassThru -NoNewWindow
try {
    Wait-Process -Id $whisper.Id, $backend.Id
} finally {
    foreach ($process in @($whisper, $backend)) {
        if ($process -and -not $process.HasExited) { Stop-Process -Id $process.Id -Force }
    }
}
