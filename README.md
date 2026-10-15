# Fontana School Guide

Aplicación web construida con TypeScript, Vite, Express y Prisma. Incluye acceso de asesores y administradores, registro de asesores y perfil inicial, usando la tabla existente `induccion.usuarios` en Neon.

## Arquitectura

| Carpeta | Responsabilidad |
| --- | --- |
| `src/` y `public/` | Vista web existente (frontend Vite). |
| `server/models/` | Acceso a datos mediante Prisma. |
| `server/controllers/` | Lógica de las solicitudes HTTP. |
| `server/routes/` | Definición de endpoints. |
| `server/views/` | Publicación de la vista compilada. |
| `server/middleware/` | Manejo transversal de errores y rutas. |
| `prisma/` | Esquema y futuras migraciones de PostgreSQL. |

## Desarrollo local

Requiere Node.js 22.12 o superior.

En Windows, ejecuta `Iniciar-FontanaSchool.cmd` con doble clic o desde la terminal:

```powershell
.\Iniciar-FontanaSchool.cmd
```

El lanzador comprueba el entorno, instala las dependencias si faltan, inicia ambos servidores y abre la aplicación en el navegador. Para detenerla, presiona `Ctrl+C` en su ventana.

También puedes iniciarla manualmente:

```powershell
npm.cmd install
npm.cmd run dev
```

Vite publica el frontend y redirige `/api` al servidor Express local. El endpoint `GET /api/health` comprueba tanto el servidor como la conexión a Neon.

Abre `http://127.0.0.1:5173/login`. El asesor ingresa con documento y contraseña; el administrador, con documento o correo administrativo y contraseña.

## Variables de entorno

Copia `.env.example` como `.env` y completa:

- `DATABASE_URL`: conexión agrupada (pooler) usada por la aplicación.
- `DIRECT_URL`: conexión directa usada por las migraciones.
- `PORT`: puerto del servidor; Render lo define automáticamente.
- `SESSION_SECRET`: clave para firmar cookies de sesión; obligatoria en producción. Render la genera automáticamente según `render.yaml`.

El archivo `.env` está ignorado por Git y nunca debe subirse al repositorio.

## Prisma y migraciones

El esquema Prisma refleja la tabla existente `induccion.usuarios`, creada fuera de Prisma. La migración `prisma/migrations/0_baseline_usuarios` es la **línea base**: describe esa tabla tal como existe en Neon, incluidos los objetos que Prisma no modela (CHECK `chk_usuarios_rol` y `chk_usuarios_estado`, índice único `uq_usuarios_correo_lower`, trigger `trg_usuarios_fecha_actualizacion` y la vista `usuarios_ruta_induccion`). Se comprobó con `prisma migrate diff` que una base creada desde la línea base es idéntica a la real.

### Registrar la línea base (una sola vez por base existente)

En la base que ya tiene `induccion.usuarios` la línea base **no se ejecuta**: solo se marca como aplicada. Hazlo primero en una rama de pruebas de Neon y, al desplegar, en producción (requiere aprobación):

```powershell
npx.cmd prisma validate
npx.cmd prisma migrate resolve --applied 0_baseline_usuarios
npx.cmd prisma migrate deploy
```

En una base vacía (rama nueva de Neon, PostgreSQL local) basta con `npx.cmd prisma migrate deploy`: la línea base crea la estructura y luego se aplican las migraciones siguientes.

Trabaja siempre contra una rama de Neon de desarrollo o pruebas, nunca contra producción. Las variables `DATABASE_URL_TEST` y `DIRECT_URL_TEST` de `.env.example` apuntan a esa base.

Las nuevas migraciones se crean revisando el SQL antes de aplicarlo:

```powershell
npm.cmd run prisma:migrate -- --name nombre_de_la_migracion
```

Comandos disponibles:

```powershell
npm.cmd run prisma:generate
npm.cmd run prisma:migrate:deploy
npm.cmd run prisma:studio
```

`prisma:migrate:deploy` aplica únicamente migraciones versionadas. El despliegue actual no lo ejecuta porque la estructura de Neon ya existía antes de Prisma.

## Compilar y ejecutar

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd start
```

Render puede leer `render.yaml`. Antes de desplegar, configura `DATABASE_URL` y `DIRECT_URL` como variables secretas del servicio.

## Documentación

- [Comandos importantes](documentacion/comandos.md)
- [Documentación técnica del proyecto](documentacion/proyecto.md)
- [Login y gestión de usuarios](documentacion/login.md)
