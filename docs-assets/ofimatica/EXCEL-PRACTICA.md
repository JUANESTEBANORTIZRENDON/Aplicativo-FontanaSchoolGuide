# Excel para cobranzas: un comando por ejercicio

La práctica tiene ocho ejercicios independientes, de 12,5 puntos cada uno. Total: 100 puntos; mínimo de aprobación: 80. Solo se muestra un ejercicio y su comando a la vez.

1. **Filtrar:** mostrar clientes pendientes. No se solicita editar ni deshacer.
2. **Ctrl+Z:** restaurar el saldo original de Camila. El cambio equivocado ya está preparado.
3. **Menor a mayor:** ordenar saldos en forma ascendente.
4. **Mayor a menor:** ordenar saldos en forma descendente, en otra pantalla.
5. **Ctrl+C:** copiar A2. Se valida la copia sin exigir pegar.
6. **Ctrl+V:** pegar en F3. El portapapeles del simulador ya está preparado, aunque se haya omitido el ejercicio anterior.
7. **Ctrl+B:** abrir el buscador y encontrar a Laura Méndez.
8. **Ctrl+G:** guardar una observación ya preparada, sin exigir otra tarea previa.

La ayuda y Reiniciar ejercicio se limitan al comando actual. Se conserva el resto del avance. Los atajos actúan solo con el foco dentro del simulador; los botones equivalentes se registran como `button`, y los eventos de teclado como `shortcut`. La tabla muestra datos ficticios y conserva cada fila completa al ordenar.

## Persistencia y compatibilidad

Se reutilizan Attempt, ExcelAttemptResult y AttemptAnswer, sin migraciones. El estado se persiste en `ExcelAttemptResult.configSnapshot.practice`, ahora en versión 2. Cada acción pasa por el servidor; la calificación utiliza únicamente el estado persistido. `stepResults` sigue siendo un arreglo compatible con informes y métricas.

Los intentos abiertos de la versión anterior se convierten a los ocho comandos, conservando los ejercicios y pasos que ya habían sido validados. Los intentos cerrados conservan sus cinco resultados y su puntaje histórico. Los demás módulos y sus límites de intentos no cambian.

Guardar confirma `savedRows` y `savedAt` dentro de una transacción. La pantalla solo muestra “Cambios guardados” al recibir la confirmación. Una recarga recupera la hoja y el avance. Las revisiones evitan sobreescribir silenciosamente el estado desde otra pestaña. La aprobación continúa por el servicio habitual de progreso y sellos. Excel permite reintentos sin límite ni espera.

Rutas: GET `/api/training/office/excel/activity`; POST `/excel/activity/:id/attempts`, `/actions` y `/submit`, con el mismo prefijo.

## Archivos principales

- `server/domain/excel-practice.ts`: escenarios individuales, validación y compatibilidad.
- `server/services/office-excel.service.ts`: recuperación, acciones y calificación.
- `src/office/excel.ts`, `api.ts`, `office.css`: interfaz, atajos y estados.
- `server/domain/office-content.ts`, `src/admin/office-admin.ts`, `prisma/seed-demo.ts`: textos y demostración actualizados.
- `server/__tests__/excel-practice*.ts`, `office-content.test.ts`: pruebas del recorrido y persistencia.
- `vite.config.ts`: permite actualizar en desarrollo únicamente el motor puro de Excel compartido con el navegador; el resto del servidor permanece excluido del observador de Vite.

## Verificación

TypeScript, compilación Vite y 201 pruebas unitarias correctas. Incluyen 17 pruebas de Excel para aislamiento de comandos, recuperación de errores, filas completas, guardado, revisiones, propiedad de intentos, métodos de entrada y conversión de intentos anteriores. Se actualizaron las pruebas HTTP del recorrido completo. En el navegador se completaron los ocho ejercicios aislados, comprobando la restauración con Ctrl+Z, los controles únicos de cada ordenación, copia y pegado separados, búsqueda con Ctrl+B y guardado con Ctrl+G recuperado después de recargar.

La revisión de navegador utiliza el renderizador real con datos y almacenamiento aislados; no consume intentos reales. Las pruebas de servicio simulan Prisma. La prueba HTTP contra PostgreSQL queda pendiente por falta de `DATABASE_URL_TEST`. Para ejecutarla, configurar una base independiente y usar `npm.cmd test -- server/__tests__/office-content.test.ts`.
