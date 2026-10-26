# Certificación al finalizar el examen general

La ruta muestra cinco módulos. El módulo 05, Examen general, utiliza la ilustración del certificado. El registro técnico de certificado se conserva para los prerrequisitos, las rutas de consulta y el historial, pero no aparece como una sexta tarjeta.

Al enviar un examen aprobado, una sola transacción guarda las respuestas calificadas, el resultado, el sello, el certificado y el resumen del ciclo. La emisión vuelve a comprobar todos los sellos y actividades obligatorias; Tipifica y Examen general requieren intentos reales aprobados. Si faltan requisitos, el resultado se conserva y la consulta de certificación indica lo pendiente.

El certificado se muestra automáticamente dentro del resultado aprobado y se puede descargar desde allí. Un examen reprobado no emite certificado. Los reintentos del envío reutilizan el certificado activo y no reactivan certificados anulados.

Las emisiones automáticas tienen `approvedById = null` y auditoría con `automatic: true`; los informes muestran «Emisión automática». Las decisiones administrativas históricas se conservan. Los nuevos resúmenes utilizan la versión 2 del plan.

Antes de desplegar: aplicar `prisma migrate deploy` y generar el cliente con `prisma generate`. La migración `20261023180000_certificacion_automatica` únicamente permite nulos en el aprobador del resumen; no elimina registros.
