# Excel para cobranzas: simulador de hoja con siete ejercicios

La práctica se hace sobre una hoja que imita Excel de escritorio (título verde “Simulador de Excel”, cinta, cuadro de nombres, barra de fórmulas, letras de columna, filas numeradas, celda activa verde y pestaña “Gestión de cobranza”) con 14 clientes ficticios, saldos en pesos colombianos, días de mora, estado, observación, abono y saldo pendiente. Hay siete ejercicios que reparten 100 puntos exactos (14,29 los cuatro primeros y 14,28 los otros tres); se aprueba con 80, es decir, con seis de siete. Se muestra un paso a la vez y la validación es automática; no existen botones “Validar” ni botones externos que hagan la tarea.

1. **Filtrar y deshacer:** filtrar Estado = Pendiente desde la flecha del encabezado; cambiar C2 (Camila Rojas) a 450000; restaurarlo con Ctrl+Z con el filtro aún activo.
2. **Ordenar:** Saldo de menor a mayor y luego de mayor a menor desde el menú del encabezado. Siempre se mueven filas completas.
3. **Copiar y pegar:** copiar A2 con Ctrl+C (borde punteado en el origen) y pegar en F3 con Ctrl+V.
4. **Buscar:** Ctrl+B abre el buscador integrado; al buscar “Laura Méndez” se resalta y se lleva a la vista la celda.
5. **Sumar:** tres clientes y una sola tarea. En C5 escribir `=SUMA(`, arrastrar de C2 a C4 y pulsar Enter. Se cierra el paréntesis y se valida `=SUMA(C2:C4)` con resultado $1.330.000.
6. **Restar:** en C5 escribir `=`, seleccionar C2, escribir `-`, seleccionar C3 y pulsar Enter. Se valida `=C2-C3` con resultado $250.000. Sin abonos ni pasos adicionales.
7. **Guardar:** escribir una observación en F2 y guardar con Ctrl+G.

### Fórmulas
Las celdas numéricas (Saldo, Días de mora, Abono, Saldo pendiente y la fila de total) aceptan números, vacío o fórmulas que empiezan con `=`. Se admite `=A1+B1`, `=A1-B1` y `=SUMA(rango;rango…)` (evaluador `server/domain/excel-formula.ts`, sin `eval`). La celda muestra el resultado y la barra de fórmulas, la fórmula. Una fórmula con texto da `#VALOR!` y una circular, `#REF!`. Las referencias son por posición en la hoja; se recalculan siempre al cambiar, ordenar o deshacer.

## Interacción
Clic para seleccionar; flechas, Tab, Enter, Inicio/Fin, RePág/AvPág; escribir sobre una celda o doble clic/F2 para editar; Enter confirma, Esc cancela; barra de fórmulas y cuadro de nombres (escribir `C2` + Enter navega); Ctrl+C/V/Z; Ctrl+B buscar; Ctrl+G guardar. Las mismas operaciones están en la cinta (Pegar, Copiar, Deshacer, Buscar, Guardar, Borrar filtros). Cada encabezado tiene flecha con orden y filtro por valores (Aceptar/Cancelar).

Los atajos solo actúan con el foco dentro del simulador y no interfieren con otros campos de la página; en los campos de edición de la hoja, Ctrl+Z/C/V actúan sobre el texto. Se intercepta el evento para que el navegador no actúe. Si un navegador reservara un atajo, se usa el botón de la cinta (se registra como `button`; el teclado, como `shortcut`).

## Aprendizaje
La barra superior dice, por ejemplo, “Ejercicio 2 de 7 · Ordena el saldo de menor a mayor.” con “Paso 1 de 2”. “Ver pista” (o un error) marca discretamente en la hoja el elemento a usar sin ejecutar nada. El puntaje exige el resultado correcto en los datos (p. ej. saldo restaurado a 400.000, filas completas ordenadas, destino y contenido pegado), no solo la tecla. Se puede corregir y reintentar; al completar un ejercicio se avanza solo (o con “Continuar”). “Reiniciar” repone solo el ejercicio actual y “Dejar pendiente” da 0 puntos en él.

## Persistencia y arquitectura
El mismo motor puro (`server/domain/excel-practice.ts`, versión 3) se ejecuta en el navegador (respuesta inmediata) y en el servidor, que repite cada acción en orden, la guarda en `ExcelAttemptResult.configSnapshot.practice` y es la única fuente de la nota. Si el servidor falla, la hoja vuelve a la última versión confirmada y se avisa. Sin migraciones: se reutilizan Attempt, ExcelAttemptResult y AttemptAnswer.

- Historial de cambios (hasta 20 entradas: edición, pegado, orden, filtro) para Ctrl+Z.
- “Cambios sin guardar” vs “Guardado”: el título solo muestra “Guardado” cuando el servidor confirmó el guardado (`savedRows`, `savedAt`); mientras tanto “Guardando…”.
- Al recargar se recupera la hoja y el avance. Las revisiones evitan sobrescribir el estado desde otra pestaña. No se puede finalizar con cambios sin guardar.
- Intentos abiertos de las versiones 1 (5 ejercicios), 2 (8 comandos) y 3 (5 ejercicios de 20 puntos) se convierten conservando lo ya cubierto; los cerrados conservan su resultado original.

Rutas: GET `/api/training/office/excel/activity`; POST `/excel/activity/:id/attempts`, `/actions` y `/submit`.

## Archivos
- `server/domain/excel-practice.ts`: hoja, ejercicios, validación, historial y compatibilidad.
- `server/validators/office.validator.ts`, `server/services/office-excel.service.ts`: acciones y persistencia.
- `src/office/excel-sheet.ts` y `excel-sheet.css`: la hoja; `src/office/excel.ts`: lecciones y resultado.
- `server/domain/office-content.ts`, `src/admin/office-admin.ts`, `prisma/seed-demo.ts`: textos y demostración.
- `server/__tests__/excel-practice*.ts`, `office-content.test.ts`: pruebas.

## Limitaciones
Una sola hoja; solo suma, resta y SUMA (sin otras funciones). Los encabezados no se editan. Ctrl+Cmd en Mac se acepta como Ctrl. La prueba HTTP contra PostgreSQL (`office-content.test.ts`) requiere `DATABASE_URL_TEST` y no se ejecutó.

La versión 5 conserva los ejercicios completados de la versión 4; si el asesor estaba en una fórmula, abre su hoja simplificada. Los resultados de intentos cerrados mantienen su puntaje original.
