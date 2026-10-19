# Tutor pixel art de Fontana School

Aparece en la pestaña **«Principios de trabajo»** de la bienvenida (`/induccion`): cinco opciones; al elegir una, el tutor
la explica **con voz** y mueve la boca con ella.

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
node scripts/tutor/generate-principle-audio.mjs               # sintetiza los 5 audios (voz local Piper es_MX-claude-high)
node scripts/tutor/generate-principle-audio.mjs --only respeto
node scripts/tutor/generate-principle-audio.mjs --mouth-only  # recalcula solo la boca con los .ogg existentes
```
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
