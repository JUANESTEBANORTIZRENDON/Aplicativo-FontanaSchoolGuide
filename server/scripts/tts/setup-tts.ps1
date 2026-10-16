# Deja listo el motor de voz local y ffmpeg para generar los audios del dictado. Idempotente: lo que ya está
# instalado se detecta y no se reinstala. No usa servicios en la nube.
#   Preferido: Piper (voz neuronal offline, sin permisos de administrador).
#   Alternativa: voz de Windows (SAPI) en español.
# Al final escribe %LOCALAPPDATA%\fontana-tts\config.json, que lee server/scripts/generate-dictation-audio.ts.
param([switch]$SoloSapi)

# Continue: en PowerShell 5.1 las advertencias que pip o winget escriben en stderr no deben detener el script;
# los fallos reales se detectan comprobando el resultado y se lanzan con throw.
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'
$base = Join-Path $env:LOCALAPPDATA 'fontana-tts'
$voicesDir = Join-Path $base 'voices'
New-Item -ItemType Directory -Force -Path $voicesDir | Out-Null

function Write-Paso($texto) { Write-Host "-> $texto" }

# ---- Python ------------------------------------------------------------------------------------------
function Find-Python {
  $candidatos = @()
  $candidatos += Get-ChildItem "$env:LOCALAPPDATA\Programs\Python\Python3*\python.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | ForEach-Object { $_.FullName }
  $candidatos += Get-ChildItem "$env:ProgramFiles\Python3*\python.exe" -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName }
  foreach ($nombre in @('py', 'python', 'python3')) {
    $cmd = Get-Command $nombre -ErrorAction SilentlyContinue
    # El python.exe de WindowsApps es solo un acceso a la Tienda: no sirve.
    if ($cmd -and $cmd.Source -notlike '*WindowsApps*') { $candidatos += $cmd.Source }
  }
  foreach ($ruta in $candidatos) {
    try { $null = & $ruta --version 2>&1; if ($LASTEXITCODE -eq 0) { return $ruta } } catch { }
  }
  return $null
}

$python = $null
if (-not $SoloSapi) {
  $python = Find-Python
  if (-not $python) {
    Write-Paso 'Instalando Python 3.12 con winget...'
    try {
      winget install --id Python.Python.3.12 -e --silent --scope user --accept-source-agreements --accept-package-agreements | Out-Host
    } catch { Write-Host "   winget no pudo instalar Python: $($_.Exception.Message)" }
    $python = Find-Python
  }
  if ($python) { Write-Paso "Python: $python" } else { Write-Host '   Python no quedó disponible; se usará la voz de Windows.' }
}

# ---- Piper -------------------------------------------------------------------------------------------
$engine = $null; $voice = $null; $modelPath = $null; $license = $null; $descartes = @()
if ($python) {
  $tienePiper = $false
  try { & $python -m piper --help *> $null; $tienePiper = ($LASTEXITCODE -eq 0) } catch { }
  if (-not $tienePiper) {
    Write-Paso 'Instalando piper-tts (pip --user)...'
    & $python -m pip install --user --disable-pip-version-check --no-warn-script-location --quiet piper-tts | Out-Host
    try { & $python -m piper --help *> $null; $tienePiper = ($LASTEXITCODE -eq 0) } catch { }
  }
  if ($tienePiper) {
    $opciones = @(
      @{ ruta = 'es/es_MX/claude/high'; nombre = 'es_MX-claude-high' },
      @{ ruta = 'es/es_MX/ald/medium'; nombre = 'es_MX-ald-medium' }
    )
    foreach ($op in $opciones) {
      $dir = Join-Path $voicesDir $op.nombre
      New-Item -ItemType Directory -Force -Path $dir | Out-Null
      $url = "https://huggingface.co/rhasspy/piper-voices/resolve/main/$($op.ruta)"
      try {
        foreach ($archivo in @("$($op.nombre).onnx", "$($op.nombre).onnx.json", 'MODEL_CARD')) {
          $destino = Join-Path $dir $archivo
          if (-not (Test-Path $destino) -or (Get-Item $destino).Length -eq 0) {
            Write-Paso "Descargando $($op.ruta)/$archivo..."
            Invoke-WebRequest -Uri "$url/$archivo" -OutFile $destino -UseBasicParsing -ErrorAction Stop
          }
        }
        $card = Get-Content (Join-Path $dir 'MODEL_CARD') -Raw -Encoding UTF8 -ErrorAction Stop
        $lic = ([regex]::Match($card, '(?im)^\*\s*License:\s*(.+)$')).Groups[1].Value.Trim()
        if (-not $lic) { $lic = ([regex]::Match($card, '(?im)licen[sc]e[^\n]*')).Value.Trim() }
        if ($card -match '(?i)non[- ]?commercial|CC[- ]BY[- ]NC|not for commercial') {
          $descartes += "$($op.nombre): licencia no comercial ($lic)"
          continue
        }
        $engine = 'piper'; $voice = $op.nombre; $modelPath = Join-Path $dir "$($op.nombre).onnx"; $license = if ($lic) { $lic } else { 'Ver MODEL_CARD' }
        break
      } catch {
        $descartes += "$($op.nombre): no se pudo descargar ($($_.Exception.Message))"
      }
    }
  } else {
    $descartes += 'Piper: no quedó instalado'
  }
}

# ---- Voz de Windows (SAPI) ---------------------------------------------------------------------------
if (-not $engine) {
  Add-Type -AssemblyName System.Speech
  $buscar = { (New-Object System.Speech.Synthesis.SpeechSynthesizer).GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -in @('es-CO', 'es-MX', 'es-ES') } | Select-Object -First 1 }
  $sapi = & $buscar
  if (-not $sapi) {
    Write-Paso 'Instalando la voz de Windows en español (requiere permisos de administrador)...'
    $cmd = "Add-WindowsCapability -Online -Name 'Language.TextToSpeech~~~es-MX~0.0.1.0'; if (-not `$?) { Add-WindowsCapability -Online -Name 'Language.TextToSpeech~~~es-ES~0.0.1.0' }"
    Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile', '-Command', $cmd
    $sapi = & $buscar
  }
  if (-not $sapi) { throw 'No quedó disponible ningún motor de voz en español (ni Piper ni SAPI).' }
  $engine = 'sapi'; $voice = $sapi.VoiceInfo.Name; $license = 'Voz incluida en Windows (Microsoft), uso local'
}

# ---- ffmpeg ------------------------------------------------------------------------------------------
function Find-Ffmpeg {
  $cmd = Get-Command ffmpeg -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  $winget = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\Gyan.FFmpeg*\*\bin\ffmpeg.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($winget) { return $winget.FullName }
  return $null
}
$ffmpeg = Find-Ffmpeg
if (-not $ffmpeg) {
  Write-Paso 'Instalando ffmpeg con winget...'
  try { winget install --id Gyan.FFmpeg -e --silent --accept-source-agreements --accept-package-agreements | Out-Host } catch { }
  $ffmpeg = Find-Ffmpeg
}
if (-not $ffmpeg -and $python) {
  Write-Paso 'Instalando imageio-ffmpeg (pip --user) como alternativa...'
  & $python -m pip install --user --disable-pip-version-check --no-warn-script-location --quiet imageio-ffmpeg | Out-Host
  $ffmpeg = (& $python -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())").Trim()
}
if (-not $ffmpeg) { throw 'No fue posible instalar ffmpeg.' }
$ffprobe = Join-Path (Split-Path $ffmpeg) 'ffprobe.exe'
if (-not (Test-Path $ffprobe)) { $ffprobe = $null }

$config = [ordered]@{ engine = $engine; voice = $voice; modelPath = $modelPath; license = $license; python = $python; ffmpeg = $ffmpeg; ffprobe = $ffprobe; descartes = $descartes }
$config | ConvertTo-Json | Set-Content -Path (Join-Path $base 'config.json') -Encoding utf8

Write-Host ''
Write-Host "Motor: $engine"
Write-Host "Voz: $voice"
Write-Host "Licencia: $license"
Write-Host "ffmpeg: $ffmpeg"
if ($descartes.Count) { Write-Host "Descartes: $($descartes -join '; ')" }
Write-Host "Configuración: $(Join-Path $base 'config.json')"
