# Enfréntate a la objeción: cinco casos y evaluación escrita

Se trabaja en `feature/modulo-02-induccion-cobranzas`, conservando el módulo 03 y la ruta `/induccion/modulos/simulador-cobranzas`.

## Experiencia

La presentación sigue el modelo de la inducción: cabecera compacta y una tarjeta principal amplia y centrada, sin el menú lateral «Tu recorrido». Se retiraron la barra de progreso y el encabezado redundante de etapa para que el contenido comience más arriba. En la introducción se navega con las flechas y el contador inferior; los accesos numerados se conservan en la evaluación y la práctica. Los accesos para repasar los casos, retomar un intento abierto o volver a resultados quedan como enlaces discretos debajo del contenido. Los sliders usan una tarjeta vertical compacta y centrada, con una ilustración pequeña, título, explicación breve, tres acciones con iconos, un ejemplo corto siempre visible y una advertencia breve en «Evita». Los resúmenes de presentación están en case-visuals.ts y no modifican las reglas de evaluación. Pistas, editor, botones y resultados comparten tipografía legible y los tonos crema, vino y dorado. Los estilos nuevos están limitados al módulo 03 y no cambian la evaluación ni los otros módulos.

La introducción presenta cinco sliders: falta de dinero, desconocimiento de la deuda, pago reportado, inconformidad por llamadas/mensajes y salario pendiente. Cada uno explica el enfoque en tres pasos, una acción a evitar y un ejemplo siempre visible en un recuadro, sin desplegarlo. En «No tengo dinero» se incluye consultar voluntariamente apoyo de terceros u otras alternativas para reunir el dinero; se diferencia de imponer préstamos o contactar terceros por cuenta propia. La navegación es local e inmediata, con Anterior, Siguiente caso y accesos libres a los cinco casos. No se guardan lecturas ni confirmaciones de comprensión; no hay puntos o marcas de completado por diapositiva. La evaluación está disponible sin exigir confirmaciones previas.

La evaluación muestra un caso por pantalla. El asesor puede escribir o pegar en un cuadro su respuesta al cliente y la gestión que registraría. El borrador se guarda automáticamente, conserva los saltos de línea y permite volver a editar antes del envío. No hay botón «Guardar borrador». Al cambiar de caso o sección, revisar las respuestas o enviar la evaluación, se reutiliza la ventana de Fontana de Excel («Guardando resultados»). Solo confirma el éxito tras la respuesta del servidor; si falla, cierra la ventana y conserva el texto y el caso actual. El guardado automático mientras se escribe permanece en segundo plano. La cola serial de guardado evita que respuestas antiguas sobrescriban las recientes por latencia. Se advierte al salir con cambios pendientes.

Cada caso aporta 20 puntos cuando la respuesta propone una acción relacionada con la situación. Se aceptan preguntas, notas de gestión y respuestas breves, sin exigir un guion ni cinco criterios. No hay mínimo de 40 caracteres: solo se exige texto no vacío (máximo 1500). La revisión busca una acción y vocabulario relacionado en una expresión de al menos dos palabras; el texto ajeno al caso o que únicamente repite el problema recibe orientación. Se califica en el servidor, con la nota mínima de la evaluación activa (80 por defecto). Los límites y las reactivaciones existentes del aula continúan aplicándose. Solo aprobar emite el sello y habilita la siguiente etapa.

El resultado conserva las cinco respuestas originales, versión de reglas, puntuación, evidencia encontrada, criterios pendientes y recomendaciones. Se puede practicar una versión mejorada después sin cambiar la nota oficial ni consumir intentos. El expediente administrativo muestra el mismo detalle. Una evaluación no aprobada integra sus recomendaciones con la constancia y la solicitud de reintento existentes.

Al aprobar, los resultados muestran permanentemente el mismo sello gráfico de Fontana usado por la celebración compartida, junto con la nota real y los accesos al siguiente módulo y al progreso del aula. El detalle de respuestas queda debajo, desplegable. Al recuperar resultados guardados no se repite la celebración. Los resultados no aprobados no muestran el sello de éxito. El SVG usa identificadores separados para evitar conflictos con el sello de la animación.

## Sistema experto y límites

Los sliders incorporan ilustraciones vectoriales distintas para los cinco casos: billetera y opciones de apoyo, documento con lupa, comprobante pendiente de revisión, teléfono con mensajes y calendario con fecha por confirmar. Los tres pasos se presentan como tarjetas con iconos y números. Las ilustraciones no representan datos reales ni acreditan pagos o acuerdos. El contenido completo de «Evita» y el ejemplo permanece visible; se conservan las flechas, la navegación local y la adaptación a pantallas pequeñas.

Es un sistema de reglas locales versionadas, no un servicio externo de IA. La política simplificada (versión 2) reconoce vocabulario cotidiano, ignora tildes/mayúsculas y admite redacción libre. Los antiguos criterios y los patrones de acciones inadecuadas solo generan hasta dos sugerencias desplegables: no restan puntos ni bloquean la aprobación. El asesor ve «Respuesta aprobada» y su puntuación, sin una lista de cinco requisitos pendientes.

No comprende exhaustivamente cualquier redacción posible. Una formulación válida que no coincida con las expresiones contempladas puede necesitar revisión del administrador. El expediente conserva el texto original y las sugerencias para permitir esa revisión. Los nuevos envíos y la práctica usan la política simplificada; los resultados ya enviados conservan su nota y revisión original y no se recalculan al consultarlos. No se exige una frase exacta.

Los casos son ficticios. No establecen horarios, frecuencias legales de contacto, condiciones de negociación ni autorizaciones inexistentes: remiten al protocolo interno y a fuentes autorizadas.

## Persistencia y compatibilidad

Se reutilizan `Attempt`, la evaluación vigente, el servicio de intentos y `CollectionsBlockProgress`. Los borradores y resultados tienen una fila por número de intento, bajo `obj-intento-`. Las filas históricas de lectura permanecen archivadas sin consultarse ni actualizarse. El endpoint anterior de confirmación responde sin escribir, para mantener compatibles las pestañas antiguas. Al iniciar el examen se cierra la actividad introductoria del catálogo y se registra el 50 % técnico del módulo; esto no certifica lectura ni comprensión de los sliders. Solo aprobar el examen completa el módulo y emite su sello. La versión de almacenamiento de bloques es 2; el formato de borrador y la configuración del catálogo permanecen en 1 para recuperar intentos abiertos. La versión de la política de calificación se guarda por separado en `result.version = 2`. No se requiere otra migración. El reinicio completo existente archiva esas filas junto con el resto del ciclo. El cliente no envía puntuaciones ni veredictos.

La migración `20261026160000_objeciones_evaluacion_escrita` agrega una actividad SIMULATOR obligatoria y su evaluación. Conserva módulos ya completados mediante una equivalencia de progreso, sin fabricar notas ni intentos; esas personas tienen acceso a repaso y práctica. Los bloques de la introducción anterior permanecen almacenados con su versión original. La función SQL de progreso antigua no expone `contentVersion`, por lo que este módulo lee la configuración completa por su id para fijar las reglas correctas.

## Archivos principales

- `server/domain/objections-expert.ts`: cinco casos, rúbrica y motor de reglas.
- `server/services/objections.service.ts` y `server/routes/training-objections.routes.ts`: introducción, borradores, envío y práctica.
- `src/objections/objections.ts`, `objections-expert.css`, `case-visuals.ts`, `save-queue.ts`: sliders ilustrados, editor, resultados y guardado.
- `server/services/evaluation-result.service.ts`, `retry-report.service.ts`, `src/admin/certification-admin.ts`: historial, constancias y revisión administrativa.
- `prisma/seed-base.ts` y la migración indicada: catálogo y compatibilidad histórica.

## Verificación

- TypeScript y compilación de producción.
- Suite unitaria: reglas, equivalencias, negaciones, recomendaciones, acciones críticas, puntuación y cola de guardado.
- `npx tsx server/scripts/verify-objections-rollback.ts --rollback`: prueba real en PostgreSQL de acceso, ausencia de registros de lectura, inicio directo del examen, borrador recuperado, respuestas incompletas, aprobación, fallo, doble envío, sello, práctica e integración con la constancia. Crea cuentas ficticias dentro de una transacción que siempre se revierte y verifica que no queden persistidas.
- `server/__tests__/objections.test.ts`: recorrido HTTP para una base de pruebas separada; no ejecutado contra usuarios reales.
- Revisión visual en navegador pendiente: el navegador de pruebas no estuvo disponible durante esta entrega. No se agregaron dependencias para sustituirlo.
