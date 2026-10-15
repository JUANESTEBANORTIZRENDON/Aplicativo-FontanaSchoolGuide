# Login y gestión de usuarios

## Base de datos existente

El login usa `induccion.usuarios` en Neon. El esquema tiene roles `administrador` y `asesor`, y estados `activo`, `inactivo` y `bloqueado`. Se conservó la tabla y sus restricciones. Prisma la mapea en `prisma/schema.prisma`.

Ya existe una cuenta administradora y una asesora activas. Por eso el comando de inicialización no crea un administrador duplicado. Las contraseñas existentes están almacenadas como hashes bcrypt; no es posible recuperar la contraseña original de un hash.

## Inicio de sesión

- Asesor: número de documento y contraseña.
- Administrador: número de documento o correo administrativo y contraseña.
- Las credenciales se comparan con bcrypt. Sólo pueden entrar cuentas en estado `activo`.
- El servidor entrega una cookie HttpOnly firmada y revisa el estado del usuario en cada solicitud protegida.
- Los intentos incorrectos se limitan por dirección IP durante 15 minutos.
- Las operaciones que modifican datos verifican el origen de la solicitud.

## Primer acceso del asesor

1. El administrador crea el asesor con nombre completo, documento y contraseña temporal.
2. Completa “Llena tus datos”: correo obligatorio con formato válido y teléfono opcional.
3. Continúa directamente a `/induccion`, sin confirmar ni cambiar la contraseña.

El formulario no solicita experiencia ni modifica los valores históricos de esa columna. La finalización del perfil se guarda en las columnas existentes; todos los asesores acceden al mismo módulo de inducción.

## Selección de la ruta de práctica

En la etapa 05 de la inducción, la confirmación de lectura habilita la pregunta de experiencia. Al confirmar, se guarda `tiene_experiencia_cobranzas_digitales` y la fecha de respuesta en la cuenta autenticada:

- Sin experiencia: `/practica/nuevo`.
- Con experiencia: `/practica/experiencia`.

Al volver a ingresar se conserva la ruta guardada. Ambas muestran por ahora un destino del módulo 02 sin ejercicios. Desde allí se puede volver a `/induccion` para repasar o cambiar la respuesta. El servidor valida la sesión, el rol asesor, el perfil completo y que el valor recibido sea booleano.

## Panel administrador

En `/admin` se pueden crear, buscar, revisar, editar y desactivar asesores. La desactivación conserva el registro y bloquea de inmediato el acceso. Un asesor desactivado puede reactivarse desde el mismo panel.

El panel no muestra ni devuelve hashes de contraseñas. Al crear un asesor, su contraseña temporal sólo la conoce el administrador que la escribió y debe compartirse por un canal seguro.

## Administrador inicial

Al arrancar el servidor se verifica si existe alguna cuenta con rol `administrador`, `admin` o `administrator`. Si no existe ninguna, se crea una cuenta de rol `administrador` con documento y contraseña aleatorios, y se imprimen una sola vez en la consola del servidor. También puede ejecutarse manualmente:

```powershell
npm.cmd run admin:bootstrap
```

Si ya existe un administrador, se informa sin modificarlo ni crear otro. La base actual ya contiene uno; sus credenciales originales no pueden leerse desde la base.

## API

| Método | Ruta | Acceso |
| --- | --- | --- |
| POST | `/api/auth/login` | Público |
| GET | `/api/auth/me` | Usuario autenticado |
| POST | `/api/auth/logout` | Usuario autenticado |
| POST | `/api/auth/completar-datos` | Asesor autenticado |
| POST | `/api/auth/experiencia` | Asesor autenticado con perfil completo |
| GET | `/api/admin/asesores` | Administrador |
| POST | `/api/admin/asesores` | Administrador |
| PUT | `/api/admin/asesores/:id` | Administrador |
| DELETE | `/api/admin/asesores/:id` | Administrador; desactiva |

## Configuración

La conexión de Neon se obtiene de `DATABASE_URL`. `DIRECT_URL` queda para operaciones de Prisma. `SESSION_SECRET` debe configurarse en producción y no debe guardarse en Git. En desarrollo, si no se define, se genera una clave temporal; al reiniciar el servidor, las sesiones anteriores dejan de ser válidas.
