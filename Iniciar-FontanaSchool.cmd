@echo off
setlocal
title Fontana School - Servidor local

cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo ERROR: Node.js no esta instalado o no se encuentra en PATH.
  echo Instala Node.js 22.12 o superior y vuelve a ejecutar este archivo.
  echo.
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo.
  echo ERROR: npm no esta disponible en PATH.
  echo Reinstala Node.js incluyendo npm y vuelve a intentarlo.
  echo.
  pause
  exit /b 1
)

if not exist ".env" (
  echo.
  echo ERROR: No existe el archivo .env con la configuracion local.
  echo Crea el archivo a partir de .env.example antes de iniciar.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Instalando dependencias por primera vez...
  call npm.cmd install
  if errorlevel 1 (
    echo.
    echo ERROR: No fue posible instalar las dependencias.
    echo.
    pause
    exit /b 1
  )
)

echo.
echo Iniciando Fontana School...
echo La aplicacion se abrira automaticamente en el navegador.
echo Para detenerla, vuelve a esta ventana y presiona Ctrl+C.
echo.

call npm.cmd run dev
set "FONTANA_EXIT_CODE=%ERRORLEVEL%"

if not "%FONTANA_EXIT_CODE%"=="0" (
  echo.
  echo El servidor termino con un error.
  pause
)

exit /b %FONTANA_EXIT_CODE%
