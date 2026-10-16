# Imágenes del módulo "Ofimática para tus cobranzas"

Las imágenes **no se generan dentro de la aplicación**. Se crean una sola vez con una herramienta externa de ilustración y se suben desde el panel (**Ofimática → Medios**) o con `PUT /api/admin/training/office/media/<archivo>`. Mientras falten, el asesor ve un marcador con el texto alternativo y la lección sigue funcionando.

## Requisitos comunes

- Formato **WebP**, relación **16:9** (se usan 1280 × 720 px) y **hasta 1 MB** por archivo.
- Ilustración editorial limpia, fondo claro, azul oscuro y coral de Fontana.
- **Sin logos de Excel, Microsoft ni de ninguna marca.**
- **Sin datos reales**: ni nombres, cédulas, teléfonos, correos ni empresas.
- **Sin texto pequeño**: si lleva texto, que sea de una o dos palabras y grande.
- El texto alternativo y las instrucciones van en el HTML de la aplicación (ya están en `server/domain/office-content.ts`); la imagen es apoyo visual.

## Archivos

| Archivo | Texto alternativo (ya en la aplicación) | Prompt sugerido |
| --- | --- | --- |
| `excel-filtro.webp` | Ilustración de una hoja de cálculo con una columna filtrada por empresa y un cliente resaltado. | Ilustración editorial plana de una hoja de cálculo genérica con una columna filtrada: un embudo sobre el encabezado de una columna y una sola fila resaltada en coral. Fondo claro, azul oscuro y coral, composición limpia 16:9, sin logos, sin marcas, sin datos reales, sin texto pequeño. |
| `excel-seguimiento.webp` | Ilustración de una tabla de seguimiento con fechas ordenadas de la más próxima a la más lejana. | Ilustración editorial plana de una tabla de seguimiento con un calendario y una flecha que ordena las filas de la fecha más próxima a la más lejana. Fondo claro, azul oscuro y coral, 16:9, sin logos, sin marcas, sin datos reales, sin texto pequeño. |
| `excel-formula.webp` | Ilustración de una celda con una fórmula de resta entre dos columnas y el total sumado al final. | Ilustración editorial plana de una celda destacada con el signo igual, dos columnas conectadas por una resta y un total sumado al final de la columna. Fondo claro, azul oscuro y coral, 16:9, sin logos, sin marcas, sin datos reales, sin texto pequeño. |
| `orto-homofonas.webp` | Ilustración con pares de palabras que suenan igual pero se escriben distinto, como a ver y haber. | Ilustración editorial plana de dos globos de diálogo con el mismo sonido representado por ondas y dos tarjetas distintas debajo, para ilustrar palabras que suenan igual pero se escriben distinto. Fondo claro, azul oscuro y coral, 16:9, sin logos, sin datos reales, sin texto pequeño. |
| `orto-tildes.webp` | Ilustración de pares de palabras con y sin tilde, como tú y tu o él y el. | Ilustración editorial plana de dos tarjetas gemelas, una con una tilde grande en coral sobre la vocal y otra sin ella, mostrando que la tilde cambia el significado. Fondo claro, azul oscuro y coral, 16:9, sin logos, sin datos reales, sin texto pequeño. |
| `orto-observacion.webp` | Ilustración de una observación de cobranza redactada con claridad en una pantalla de gestión. | Ilustración editorial plana de una pantalla de gestión de cobranzas con una nota breve bien redactada y una marca de verificación coral. Fondo claro, azul oscuro y coral, 16:9, sin logos, sin datos reales, sin texto pequeño. |

> Los prompts son una propuesta alineada con las reglas del documento de trabajo; el equipo de diseño puede ajustarlos mientras se respeten los requisitos comunes.

## Después de generarlas

1. Convierte a WebP y verifica que cada archivo pese menos de 1 MB.
2. Súbelas desde **Ofimática → Medios** (la clave debe ser exactamente el nombre del archivo).
3. Comprueba en una lección que la imagen cargue con `loading="lazy"` y que el texto alternativo describa lo que se ve.
