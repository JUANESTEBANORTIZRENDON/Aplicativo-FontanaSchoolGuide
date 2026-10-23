# Tutor pixel art de Fontana School

Aparece en la pestaña **«Principios de trabajo»** de la bienvenida (`/induccion`): cinco opciones; al elegir una, el tutor
la explica **con voz** y mueve la boca con ella.
También acompaña los mensajes de la práctica de cobranzas, sin intervenir en la validación ni en el progreso.

## Expresiones e interacción
- `src/tutor/manifest.ts` define secuencias breves de orientación, aprobación, reflexión y celebración, reutilizando los PNG existentes.
- `src/tutor/speech-motion.ts` combina la señal de voz con pequeñas pausas de boca y parpadeos durante silencios en reposo.
- `src/tutor/feedback.ts` añade un avatar compacto a los mensajes existentes y detiene sus gestos mientras se escribe. Libera los eventos y temporizadores al abandonar la actividad.
- El reposo incluye parpadeos espaciados y movimientos ocasionales de cabeza. Con movimiento reducido se muestran poses estáticas, sin bucles animados.

## Qué hay aquí
- `referencias/` — las **láminas originales** (solo referencia, no se publican):
  - `tutor-retrato-base.png`: identidad del personaje.
  - `poses-cuerpo-storyboard.png`: 8 gestos del cuerpo (cuadrícula 4×2, con números y marcos).
  - `poses-cabeza-nueve.png`: 9 poses de cabeza (cuadrícula 3×3, con números y marcos).

## Cuadros de producción (no se editan a mano)
```bash
node scripts/tutor/build.mjs            # → public/tutor/frames/*.png y src/tutor/frame-geometry.ts
node scripts/tutor/build.mjs <carpeta>  # además deja láminas de revisión (fondo crema y vino)
```
Proceso (`scripts/tutor/`): recorta cada cuadro por dentro del marco, quita el fondo por relleno desde los bordes (y los huecos
encerrados), descarta números y rayitas de movimiento, compone la cabeza de la lámina de nueve poses sobre el cuerpo
alineada por el **cuello**, y coloca todo en un lienzo común (424×484) con alfa binaria. Resultado: 23 PNG transparentes.

## Voz y boca
```bash
node scripts/tutor/generate-principle-audio.mjs               # sintetiza los 5 audios con la voz masculina del tutor (Piper es_MX-ald-medium)
node scripts/tutor/generate-principle-audio.mjs --only respeto
node scripts/tutor/generate-principle-audio.mjs --mouth-only  # recalcula solo la boca con los .ogg existentes
```
La **voz masculina** es `es_MX-ald-medium` (licencia Unlicense, instalada en `%LOCALAPPDATA%ontana-ttsoices`), con el tono bajado un 6 % (`PITCH` en el script).
Es propia del tutor: no cambia la voz de los dictados (`config.json`). Tono medido (F0 mediano): 134–148 Hz; la voz anterior, `es_MX-claude-high`, daba 193 Hz.
Si falta la voz, descárgala de https://huggingface.co/rhasspy/piper-voices (carpeta `es/es_MX/ald/medium`: `.onnx`, `.onnx.json` y `MODEL_CARD`).

Salida: `public/tutor/audio/<id>.ogg` y `src/tutor/principle-audio.generated.ts`. Además del audio calcula la **línea de boca**:
un bit cada 25 ms (1 = suena la voz) a partir del volumen real. El reproductor (`src/tutor/speaker.ts`) mira en qué punto va el
audio en cada fotograma y elige el cuadro: el gesto según la coreografía y la boca abierta/cerrada según esa línea. Por eso la
boca se mueve con la voz, se detiene en las pausas y sigue funcionando si el audio se pausa o se repite.

## Cambiar un principio
1. Edita el texto en `src/tutor/principles.json` (título, resumen y `narration`).
2. Regenera su voz: `node scripts/tutor/generate-principle-audio.mjs --only <id>`.
Una prueba unitaria falla si el texto cambia y el audio no se regeneró.
La coreografía (qué gesto en cada tramo) está en `src/tutor/principles.ts`.

> El contenido actual es una **propuesta** basada en los textos ya existentes de la inducción (Método de trabajo y «Una carta a
> García»); está pendiente de validación por la empresa.
