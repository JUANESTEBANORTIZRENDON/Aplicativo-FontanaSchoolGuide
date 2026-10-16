# Sintetiza un archivo de texto a WAV con la voz de Windows (System.Speech). Alternativa cuando Piper no está.
# El texto llega por archivo (nunca por la línea de comandos).
param(
  [Parameter(Mandatory)][string]$TextFile,
  [Parameter(Mandatory)][string]$OutFile,
  [string]$Voice = '',
  [ValidateRange(-10, 10)][int]$Rate = -2
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  if ($Voice) { $synth.SelectVoice($Voice) }
  $synth.Rate = $Rate
  $synth.SetOutputToWaveFile($OutFile)
  $synth.Speak((Get-Content -Path $TextFile -Raw -Encoding UTF8))
} finally {
  $synth.Dispose()
}
