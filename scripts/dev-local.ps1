# Ayudas del lanzador Iniciar-FontanaSchool.cmd.
#   -Accion liberar : cierra procesos de Node que se quedaron ocupando los puertos 3000 (API) o 5173 (Vite).
#   -Accion abrir   : espera a que la API y Vite respondan y solo entonces abre el navegador.
param([ValidateSet('liberar', 'abrir')][string]$Accion = 'abrir')

$ErrorActionPreference = 'SilentlyContinue'

if ($Accion -eq 'liberar') {
  $ocupados = Get-NetTCPConnection -LocalPort 3000, 5173 -State Listen
  foreach ($conexion in $ocupados) {
    $proceso = Get-CimInstance Win32_Process -Filter "ProcessId=$($conexion.OwningProcess)"
    if ($proceso.Name -eq 'node.exe') {
      Write-Host "Cerrando un proceso anterior que ocupaba el puerto $($conexion.LocalPort) (PID $($conexion.OwningProcess))."
      Stop-Process -Id $conexion.OwningProcess -Force
    } elseif ($proceso) {
      Write-Host "ATENCION: el puerto $($conexion.LocalPort) lo usa otro programa ($($proceso.Name)). Cierralo y vuelve a intentar."
    }
  }
  exit 0
}

# Hasta 3 minutos: en la unidad de red el servidor puede tardar en compilar al arrancar.
for ($i = 0; $i -lt 180; $i++) {
  try {
    $api = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/api/health' -UseBasicParsing -TimeoutSec 3
    $web = Invoke-WebRequest -Uri 'http://127.0.0.1:5173/' -UseBasicParsing -TimeoutSec 3
    if ($api.StatusCode -eq 200 -and $web.StatusCode -eq 200) {
      Start-Process 'http://127.0.0.1:5173/'
      exit 0
    }
  } catch { }
  Start-Sleep -Seconds 1
}
