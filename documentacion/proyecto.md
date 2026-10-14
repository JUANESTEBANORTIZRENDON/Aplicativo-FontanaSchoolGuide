# Documentación técnica de Fontana School Guide

## 1. Descripción general

Fontana School Guide es una aplicación web de formación. Presenta una experiencia interactiva sobre la empresa y su método de trabajo mediante una interfaz construida con HTML, CSS y TypeScript.

El proyecto dejó de ser una aplicación de escritorio. No utiliza Electron ni genera instaladores de escritorio. Su destino es ejecutarse como servicio web, primero en el entorno local y posteriormente en Render.

Actualmente el frontend contiene el recorrido formativo, login, perfil inicial y panel de administración. El backend utiliza la tabla preexistente `induccion.usuarios` en Neon. Consulta [Login y gestión de usuarios](login.md) para el flujo completo.

## 2. Tecnologías

### Frontend

- **HTML5:** estructura semántica de la interfaz.
- **CSS3:** diseño visual, adaptación a diferentes tamaños y animaciones.
- **TypeScript:** interacciones, navegación, carrusel y estado de la experiencia formativa.
- **Vite:** servidor de desarrollo, proxy hacia la API y compilación optimizada.

### Backend

- **Node.js 22.12 o superior:** entorno de ejecución.
- **Express 5:** servidor HTTP, rutas, middleware y publicación del frontend.
- **TypeScript:** tipado estático del servidor.
- **tsx:** ejecución del servidor TypeScript con recarga durante el desarrollo.

### Datos

- **PostgreSQL:** base de datos relacional.
- **Neon:** servicio administrado que aloja PostgreSQL.
- **Prisma ORM 6.19:** cliente de datos, definición del esquema y migraciones.

### Operación

- **concurrently:** inicia Vite y Express con un solo comando.
- **Render:** plataforma prevista para alojar la aplicación web.
- **Git:** control de versiones; los secretos y archivos generados están excluidos.

## 3. Arquitectura general

El backend sigue una arquitectura Modelo–Vista–Controlador (MVC):

```text
Navegador
   │
   ├── archivos web ───────────────► Vista (dist/)
   │
   └── solicitudes /api
             │
             ▼
         Rutas Express
             │
             ▼
         Controladores
             │
             ▼
         Modelos Prisma
             │
             ▼
       PostgreSQL en Neon
```

### Modelo

Se encuentra en `server/models/`. Centraliza el acceso a Prisma y evita que los controladores administren directamente la conexión a la base de datos.

`database.model.ts`:

- Mantiene una instancia reutilizable de `PrismaClient`.
- Permite comprobar la conexión mediante `SELECT 1`.
- Cierra la conexión ordenadamente al detener el servidor.

`usuario.model.ts` aporta el acceso a usuarios y la selección de ruta por rol, perfil y experiencia.

### Vista

La vista es el frontend existente:

- `index.html`: estructura principal.
- `src/styles.css`: presentación visual.
- `src/main.ts`: comportamiento e interacciones.
- `src/content.ts`: contenido de las etapas.
- `public/imagenes/`: recursos gráficos.

En producción, Vite compila estos archivos en `dist/`. `server/views/web.view.ts` publica esa carpeta mediante Express y devuelve `index.html` para las rutas web.

### Controlador

Los controladores están en `server/controllers/`. Reciben solicitudes, coordinan los modelos y construyen respuestas HTTP.

El controlador actual comprueba la conectividad con la base de datos y responde el estado del servicio.

### Rutas

Las rutas están en `server/routes/`. Conectan cada dirección HTTP con su controlador.

Endpoint disponible:

| Método | Ruta | Propósito |
| --- | --- | --- |
| `GET` | `/api/health` | Comprueba el servidor y la conexión con Neon. |
| `POST` | `/api/auth/login` | Inicia sesión. |
| `GET` | `/api/auth/me` | Devuelve el usuario autenticado. |
| `POST` | `/api/auth/completar-datos` | Guarda perfil y experiencia. |
| `GET/POST/PUT/DELETE` | `/api/admin/asesores` | Gestión de asesores; actualización y desactivación usan `/:id`. |

Las rutas desconocidas bajo `/api` responden con estado `404` en formato JSON.

## 4. Estructura del repositorio

```text
Fontanaschool/
├── documentacion/             Documentación operativa y técnica
├── prisma/
│   └── schema.prisma          Mapeo de induccion.usuarios
├── public/
│   └── imagenes/              Imágenes públicas
├── server/
│   ├── controllers/           Controladores HTTP
│   ├── middleware/            Errores y respuestas transversales
│   ├── models/                Acceso a datos con Prisma
│   ├── routes/                Rutas de la API
│   ├── views/                 Publicación del frontend compilado
│   ├── app.ts                 Configuración de Express
│   └── server.ts              Inicio y cierre del servidor
├── src/                       Código del frontend
├── .env.example               Plantilla de variables de entorno
├── Iniciar-FontanaSchool.cmd  Lanzador local para Windows
├── index.html                 Documento principal del frontend
├── package.json               Dependencias y comandos
├── render.yaml                Configuración de despliegue en Render
├── tsconfig.json              TypeScript del frontend
├── tsconfig.server.json       TypeScript del backend
└── vite.config.ts             Configuración de Vite y proxy de API
```

Las carpetas generadas no deben editarse manualmente:

- `node_modules/`: dependencias instaladas.
- `dist/`: compilación del frontend.
- `server-dist/`: compilación del backend.

## 5. Funcionamiento en desarrollo

`npm run dev` inicia dos procesos:

1. Vite sirve el frontend en `127.0.0.1:5173`.
2. Express sirve la API en `127.0.0.1:3000`.

El navegador sólo necesita comunicarse con Vite. Cuando solicita una ruta que comienza por `/api`, el proxy configurado en `vite.config.ts` la envía a Express. Esto evita introducir direcciones del backend dentro del código del frontend.

El archivo `Iniciar-FontanaSchool.cmd` automatiza este flujo para Windows y abre el navegador.

## 6. Funcionamiento en producción

El proceso de compilación realiza estas tareas:

1. Genera Prisma Client.
2. Comprueba el frontend con TypeScript.
3. Compila el frontend en `dist/`.
4. Compila el backend en `server-dist/`.

Después, `npm start` ejecuta `server-dist/server.js`. En producción sólo existe un servidor público: Express atiende la API y también publica el frontend compilado.

```text
Internet ──► Render/Express ──┬──► /api/*
                             └──► dist/index.html y recursos
```

Express escucha en `0.0.0.0` y utiliza la variable `PORT`, requisito para funcionar correctamente en Render.

## 7. Base de datos y Prisma

La configuración se encuentra en `prisma/schema.prisma`.

Se utilizan dos conexiones:

- `DATABASE_URL`: conexión mediante el pooler de Neon, utilizada por la aplicación en funcionamiento.
- `DIRECT_URL`: conexión directa, utilizada por Prisma al crear y aplicar migraciones.

El esquema mapea la tabla existente `induccion.usuarios`, incluyendo sus campos de rol, estado, hash, perfil y experiencia. No fue necesario modificar esa estructura. Antes de crear la primera migración con Prisma, debe prepararse una línea base de la estructura existente. Después, el flujo será:

1. Agregar el modelo a `prisma/schema.prisma`.
2. Ejecutar `npm run prisma:migrate -- --name nombre`.
3. Revisar la migración SQL creada en `prisma/migrations/`.
4. Probar localmente.
5. Versionar tanto el esquema como la migración.
6. Aplicar en producción mediante `npm run prisma:migrate:deploy`.

Nunca debe modificarse directamente una migración que ya se haya aplicado en producción.

## 8. Variables de entorno y secretos

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Conexión agrupada de la aplicación con Neon. |
| `DIRECT_URL` | Conexión directa para migraciones. |
| `SESSION_SECRET` | Firma de las cookies de sesión. Obligatoria en producción. |
| `PORT` | Puerto HTTP; localmente usa `3000`. |
| `NODE_ENV` | Identifica el entorno, por ejemplo `development` o `production`. |

`.env.example` documenta la forma de estas variables sin incluir credenciales. `.env` contiene los valores reales y está excluido por `.gitignore`.

En Render, `DATABASE_URL` y `DIRECT_URL` deben configurarse como variables secretas del servicio, nunca escribirse directamente en `render.yaml`.

## 9. Despliegue en Render

`render.yaml` declara un servicio web Node.js con:

- Construcción: `npm ci && npm run build`.
- Inicio: `npm start`.
- Comprobación de salud: `/api/health`.
- Variables secretas para las dos conexiones de base de datos.

Durante cada despliegue, Render instala las dependencias, compila la aplicación y finalmente inicia Express. Las migraciones se habilitarán al registrar una línea base del esquema existente.

## 10. Manejo de errores y cierre

`server/middleware/error.middleware.ts` centraliza dos situaciones:

- Rutas de API inexistentes: respuesta JSON `404`.
- Errores internos o pérdida de conexión: respuesta JSON `503` sin exponer detalles técnicos al cliente.

Los detalles completos se escriben en los registros del servidor. Al recibir `SIGINT` o `SIGTERM`, el servidor deja de aceptar solicitudes, desconecta Prisma y termina de forma ordenada.

## 11. Cómo agregar un módulo nuevo

Para mantener la arquitectura:

1. Define la entidad en `prisma/schema.prisma` y crea su migración.
2. Crea un modelo en `server/models/` para las operaciones de datos.
3. Crea un controlador en `server/controllers/` para la lógica HTTP.
4. Declara sus endpoints en `server/routes/`.
5. Registra el router en `server/app.ts` bajo `/api`.
6. Consume esos endpoints desde el frontend cuando sea necesario.
7. Añade validación de entradas y pruebas para los nuevos comportamientos.

Los controladores no deben contener contraseñas ni crear instancias nuevas de Prisma por cada solicitud. Los secretos siempre se obtienen desde variables de entorno.

## 12. Estado actual y próximos pasos

Actualmente están terminados:

- Frontend formativo existente.
- Ejecución web local.
- Servidor Express con arquitectura MVC.
- Conexión comprobada con Neon.
- Prisma configurado para migraciones.
- Configuración inicial de Render.
- Lanzador local para Windows.

Quedan pendientes de definición funcional:

- Migraciones Prisma a partir de una línea base de la tabla existente.
- Persistencia del progreso formativo.
- Módulos de inducción diferenciados por experiencia.
- Pruebas automatizadas.
- Configuración final del servicio en Render y rotación de credenciales antes del despliegue.
