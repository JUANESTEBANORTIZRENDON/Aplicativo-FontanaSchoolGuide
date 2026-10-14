# Comandos importantes

Esta guía reúne los comandos necesarios para instalar, ejecutar, comprobar y desplegar Fontana School Guide. Todos deben ejecutarse desde la raíz del proyecto.

## Inicio rápido en Windows

El método recomendado para trabajar localmente es el lanzador:

```powershell
.\Iniciar-FontanaSchool.cmd
```

También puede abrirse con doble clic desde el Explorador de archivos. El lanzador:

1. Comprueba que Node.js y npm estén disponibles.
2. Comprueba que exista el archivo privado `.env`.
3. Instala las dependencias si todavía no existe `node_modules`.
4. Inicia el frontend y el servidor.
5. Abre la aplicación en `http://127.0.0.1:5173/`.

Para detener todo, vuelve a la ventana del lanzador y presiona `Ctrl+C`.

## Instalación de dependencias

Instalación normal para desarrollo:

```powershell
npm.cmd install
```

Instalación exacta desde `package-lock.json`, recomendada en integración continua y producción:

```powershell
npm.cmd ci
```

## Desarrollo

Iniciar frontend y backend simultáneamente, con recarga automática:

```powershell
npm.cmd run dev
```

Iniciar solamente el frontend Vite:

```powershell
npm.cmd run dev:frontend
```

Iniciar solamente el servidor Express:

```powershell
npm.cmd run dev:server
```

Durante el desarrollo:

- Frontend: `http://127.0.0.1:5173/`
- Backend: `http://127.0.0.1:3000/`
- Estado de servidor y base de datos: `http://127.0.0.1:3000/api/health`

Vite redirige automáticamente las solicitudes `/api` del puerto `5173` hacia Express en el puerto `3000`.

## Verificación y compilación

Comprobar los tipos TypeScript del frontend y del servidor:

```powershell
npm.cmd run check
```

Generar Prisma y compilar toda la aplicación para producción:

```powershell
npm.cmd run build
```

La compilación crea:

- `dist/`: frontend optimizado.
- `server-dist/`: servidor JavaScript compilado.

Ejecutar la compilación de producción:

```powershell
npm.cmd start
```

Previsualizar únicamente el frontend compilado mediante Vite:

```powershell
npm.cmd run preview
```

## Prisma y Neon PostgreSQL

Regenerar Prisma Client después de modificar el esquema:

```powershell
npm.cmd run prisma:generate
```

Crear y aplicar una migración durante el desarrollo, después de registrar una línea base del esquema existente en Neon:

```powershell
npm.cmd run prisma:migrate -- --name nombre_descriptivo
```

Ejemplo:

```powershell
npm.cmd run prisma:migrate -- --name crear_usuarios
```

Aplicar en producción las migraciones que ya están versionadas:

```powershell
npm.cmd run prisma:migrate:deploy
```

Abrir la interfaz visual de Prisma para inspeccionar los datos:

```powershell
npm.cmd run prisma:studio
```

Validar el archivo `prisma/schema.prisma`:

```powershell
npx.cmd prisma validate
```

Formatear el esquema de Prisma:

```powershell
npx.cmd prisma format
```

> No ejecutes `prisma migrate dev` sobre la base actual antes de preparar la línea base de `induccion.usuarios`. El despliegue actual no ejecuta migraciones automáticamente.

Verificar si ya existe un administrador y crearlo sólo si falta:

```powershell
npm.cmd run admin:bootstrap
```

## Comprobar el servicio

Con el servidor iniciado, comprobar su estado desde PowerShell:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health
```

Una respuesta correcta es:

```json
{
  "status": "ok",
  "database": "connected"
}
```

## Variables de entorno

Si no existe `.env`, crea una copia local del ejemplo:

```powershell
Copy-Item .env.example .env
```

Después completa `DATABASE_URL` y `DIRECT_URL` con las conexiones de Neon. `.env` contiene secretos, está ignorado por Git y nunca debe subirse al repositorio.

## Flujo recomendado antes de entregar cambios

```powershell
npm.cmd run check
npm.cmd run build
```

Si se modificó `prisma/schema.prisma`, crea también la migración correspondiente y revisa sus archivos antes de subirlos.
