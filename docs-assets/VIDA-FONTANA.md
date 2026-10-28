# Así vivimos Fontana

Álbum interactivo de la página de inducción, después de la presentación. Muestra fotografías y videos del día a día de la empresa.

## Qué incluye

- Visor principal con transición suave, título, descripción y contador (01 / 08).
- Flechas, teclado (← →) y gesto de deslizar en celular.
- Tira de miniaturas; los videos llevan una insignia de reproducción.
- Filtros Todo / Fotos / Videos.
- Presentación automática opcional para fotografías (se pausa al pasar el cursor, no arranca sola).
- Vista ampliada con navegación; Escape, el botón de cierre o pulsar fuera la cierran y pausan el video.
- Los videos no se reproducen solos: se inician al pulsar el botón de reproducir.
- Los espacios sin archivo muestran un marcador elegante, sin simular fotos de la compañía.
- Respeta la preferencia de movimiento reducido.

## Añadir archivos

1. Copiar fotos o videos a `public/vida-fontana/`.
2. Editar `public/vida-fontana/mural.json`. Cambiar `src: null` por una ruta como `"src": "/vida-fontana/quincena.webp"`, o añadir nuevos elementos con un `id` único. El orden del archivo es el orden del álbum.
3. `title` se muestra en grande; `caption` (opcional) es la línea descriptiva. Para fotografías, `alt` describe la imagen para lectores de pantalla. Para videos, añadir `poster` (portada) y `captions` (subtítulos WebVTT) si existen.

```json
{
  "id": "encuentro-equipo",
  "kind": "video",
  "title": "Encuentro del equipo",
  "caption": "Un día de integración en la sede.",
  "src": "/vida-fontana/encuentro.mp4",
  "poster": "/vida-fontana/encuentro-portada.webp",
  "captions": "/vida-fontana/encuentro-es.vtt"
}
```

Usar `photo` o `video` en `kind`. Las rutas deben ser locales y comenzar por `/`. Se recomienda WebP/JPG de 1600 px de ancho (formato horizontal 16:9 luce mejor) y videos MP4 (H.264). No se modifica el avance ni se añade evaluación.
