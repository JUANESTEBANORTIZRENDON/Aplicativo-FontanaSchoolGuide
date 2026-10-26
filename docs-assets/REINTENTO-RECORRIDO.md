# Reintento por evaluación y acompañamiento

Cada evaluación dispone de un intento inicial. Después de un resultado no aprobado, el asesor puede activar por sí mismo un único reintento. No hay activación automática ni intervención administrativa en ese primer reintento.

El resultado muestra una constancia visual Fontana con nombre, evaluación, intento, nota y «Aún no apto en esta evaluación». Registra el resultado, no acredita la formación ni crea un certificado de aprobación. No incluye un enlace de descarga. Las notas y los requisitos siguen calculándose en el servidor.

Si también falla el reintento, aparece «Solicitar acompañamiento al administrador». Se permite una solicitud pendiente por evaluación. El aviso consulta la aprobación cada 15 segundos y permite la consulta manual. La espera no bloquea globalmente el recorrido. Una respuesta fallida de red nunca se interpreta como aprobación.

El administrador revisa el informe y el historial. Al aprobar concede exactamente un intento adicional en la evaluación solicitada, sin reiniciar módulos, memoria, sellos, notas ni otras pruebas. Las solicitudes pendientes del flujo anterior también se resuelven con este alcance. Los archivos de ciclos anteriores se conservan para consulta.

El cupo inicial efectivo es uno, incluso con configuraciones antiguas. Los intentos adicionales requieren una excepción auditada: la primera procede de la acción del propio asesor y solo puede crearse una vez por usuario y actividad; las posteriores requieren autorización administrativa. Se conservan todas las notas y la numeración de los intentos. El bloqueo transaccional y la clave única impiden duplicar cupos con doble clic o pestañas simultáneas.

El modelo de calificación no cambia: Tipifica y el dictado mantienen su función formativa y su retroalimentación; las lecturas no se convierten en exámenes. El diagnóstico mantiene su carácter no obligatorio para avanzar. Excel conserva la posibilidad de corregir dentro del intento, pero repetir una evaluación finalizada utiliza el mismo flujo de reintento.

Se reutilizan las excepciones y solicitudes existentes; no se requiere una migración nueva. La certificación de aprobación sigue emitiéndose al cumplir los requisitos reales.

## Verificación

- Pruebas unitarias: elegibilidad, protección de acceso, reintento único, idempotencia, segundo fallo, acompañamiento y alcance individual de la aprobación.
- TypeScript y compilación de la interfaz.
- PostgreSQL real: `server/scripts/verify-evaluation-retry-rollback.ts --rollback` verifica dos fallos, reintento propio, bloqueo del tercero, solicitud, aprobación individual e historial conservado. La transacción revierte todas las cuentas y los datos temporales.
- Las pruebas de integración actualizadas requieren `DATABASE_URL_TEST`, una base separada.
