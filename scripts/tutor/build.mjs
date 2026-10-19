// Genera los cuadros de producción del tutor a partir de las láminas de referencia (assets-src/tutor/referencias).
//   node scripts/tutor/build.mjs [carpeta-de-revisión]
// Salida: public/tutor/frames/*.png (transparentes, mismo lienzo y ancla) y src/tutor/frame-geometry.ts.
// Las láminas NO se usan tal cual: cada cuadro se recorta sin borde ni número, se le quita el fondo, se compone la
// cabeza correspondiente sobre el cuerpo (alineada por el cuello) y se coloca en un lienzo común anclado a la cabeza.
import { mkdirSync, writeFileSync, statSync, readdirSync, rmSync } from 'node:fs';
import { readPng, writePng } from './png.mjs';
import { cropPanel, removeBackground, preview } from './extract.mjs';
import { blank, clone, erase, hairAnchor, neckBottom, over, scale } from './compose.mjs';

const REVIEW = process.argv[2];
const OUT = 'public/tutor/frames';
mkdirSync(OUT, { recursive: true });
for (const file of readdirSync(OUT)) if (file.endsWith('.png')) rmSync(`${OUT}/${file}`);

const bodySheet = readPng('assets-src/tutor/referencias/poses-cuerpo-storyboard.png');
const headSheet = readPng('assets-src/tutor/referencias/poses-cabeza-nueve.png');
const BODY_CELLS = [[5, 381, 5, 509], [387, 765, 5, 509], [770, 1150, 5, 509], [1155, 1532, 5, 509], [5, 381, 514, 1019], [387, 765, 514, 1019], [770, 1150, 514, 1019], [1155, 1532, 514, 1019]];
const HEAD_CELLS = [[9, 507, 7, 338], [518, 1017, 7, 338], [1028, 1527, 7, 338], [9, 507, 347, 677], [518, 1017, 347, 677], [1028, 1527, 347, 677], [9, 507, 687, 1015], [518, 1017, 687, 1015], [1028, 1527, 687, 1015]];
const BOTTOM_TRIM = 14; // restos del marco de la lámina en el borde inferior
const bodies = BODY_CELLS.map(([x0, x1, y0, y1]) => {
  const img = removeBackground(cropPanel(bodySheet, x0 + 6, y0 + 6, x1 - 6, y1 - 6));
  const anchor = hairAnchor(img);
  erase(img, (_x, y) => y >= img.height - BOTTOM_TRIM);
  return { img, anchor };
});
const heads = HEAD_CELLS.map(([x0, x1, y0, y1]) => removeBackground(cropPanel(headSheet, x0 + 8, y0 + 8, x1 - 8, y1 - 8), { tol: 8 }));

// Parámetros de composición por cuerpo: s = escala de la cabeza, nb = altura del cuello bajo la cima del cabello,
// eh/ew = bloque de la cabeza original que se borra.
const BASE = { s: 0.76, nb: 252, eh: 188, ew: 125 };
const FIST = { s: 0.76, nb: 262, eh: 188, ew: 95 };
function withHead(baseIndex, headIndex, params = BASE) {
  const { img, anchor } = bodies[baseIndex - 1], out = clone(img);
  erase(out, (x, y) => { const dy = y - anchor.top, dx = Math.abs(x - anchor.x); if (dy < params.eh && dx < params.ew) return true; if (dy >= params.eh && dy < params.eh + 62 && dx < 78 * (1 - Math.max(0, dy - params.eh - 12) / 50)) return true; return false; });
  const h = scale(heads[headIndex - 1], params.s), n = neckBottom(h);
  over(out, h, Math.round(anchor.x - n.x), Math.round(anchor.top + params.nb - n.y));
  return { img: out, anchor };
}
const original = (baseIndex) => bodies[baseIndex - 1];

// id → cuadro. «Cuerpo» = lámina de poses de cuerpo; «cabeza» = lámina de nueve poses de cabeza.
const FRAMES = {
  'rest': withHead(1, 1), 'rest-blink-half': withHead(1, 2), 'rest-blink': withHead(1, 3),
  'rest-look-right': withHead(1, 4), 'rest-turn-right': withHead(1, 5), 'rest-tilt': withHead(1, 6),
  'rest-nod': withHead(1, 7), 'rest-think-up': withHead(1, 8), 'rest-talk': withHead(1, 9),
  'wave-a': original(2), 'wave-b': original(3),
  'explain': withHead(4, 1), 'explain-talk': withHead(4, 9), 'explain-look-right': withHead(4, 4),
  'point': withHead(5, 4), 'point-turn': withHead(5, 5), 'point-talk': withHead(5, 9),
  'think': original(6),
  'affirm': withHead(7, 1, FIST), 'affirm-nod': withHead(7, 7, FIST), 'celebrate': withHead(7, 9, FIST), 'celebrate-grin': original(7),
  'tilt': original(8),
};

// Lienzo común: se calcula la extensión de todos los cuadros respecto al ancla (centro y cima del cabello).
let left = 0, right = 0, up = 0, down = 0;
for (const { img, anchor } of Object.values(FRAMES)) {
  left = Math.max(left, anchor.x); right = Math.max(right, img.width - anchor.x); up = Math.max(up, anchor.top); down = Math.max(down, img.height - BOTTOM_TRIM - anchor.top);
}
const MARGIN = 6;
const geometry = { width: Math.ceil(left + right) + MARGIN * 2, height: Math.ceil(up + down) + MARGIN * 2, anchorX: Math.ceil(left) + MARGIN, anchorY: Math.ceil(up) + MARGIN, clipBottom: 0 };
// El corte inferior de cada cuadro cae a alturas distintas (la cabeza es el ancla): se recorta el lienzo a la menor.
let lowest = 1e9; for (const { img, anchor } of Object.values(FRAMES)) lowest = Math.min(lowest, geometry.anchorY + (img.height - BOTTOM_TRIM - anchor.top));
geometry.height = Math.floor(lowest);

const rendered = {};
for (const [id, { img, anchor }] of Object.entries(FRAMES)) {
  const canvas = blank(geometry.width, geometry.height);
  over(canvas, img, Math.round(geometry.anchorX - anchor.x), Math.round(geometry.anchorY - anchor.top));
  // alfa binaria + 5 bits por canal: conserva el aspecto «pixel art» y reduce mucho el peso
  for (let p = 0; p < canvas.data.length; p += 4) { if (canvas.data[p + 3] < 128) { canvas.data[p] = canvas.data[p + 1] = canvas.data[p + 2] = canvas.data[p + 3] = 0; continue; } canvas.data[p + 3] = 255; for (let k = 0; k < 3; k++) canvas.data[p + k] = Math.min(255, (canvas.data[p + k] >> 3 << 3) + 4); }
  writePng(`${OUT}/${id}.png`, canvas); rendered[id] = canvas;
}
writeFileSync('src/tutor/frame-geometry.ts', `// Generado por scripts/tutor/build.mjs: no editar a mano.\n// Lienzo común de todos los cuadros del tutor y punto de anclaje (centro y cima del cabello).\nexport const FRAME_GEOMETRY = ${JSON.stringify(geometry)} as const;\nexport const FRAME_IDS = ${JSON.stringify(Object.keys(FRAMES))} as const;\nexport type FrameId = typeof FRAME_IDS[number];\n`);
let total = 0; for (const id of Object.keys(FRAMES)) { const size = statSync(`${OUT}/${id}.png`).size; total += size; }
console.log(`${Object.keys(FRAMES).length} cuadros de ${geometry.width}x${geometry.height}; ancla (${geometry.anchorX}, ${geometry.anchorY}); total ${(total / 1024).toFixed(0)} KB; media ${(total / 1024 / Object.keys(FRAMES).length).toFixed(0)} KB`);
if (REVIEW) { mkdirSync(REVIEW, { recursive: true }); const list = Object.values(rendered); writePng(`${REVIEW}/produccion-crema.png`, preview(list, { cols: 6, cell: { w: geometry.width, h: geometry.height }, bg: [250, 243, 229], gap: 4 })); writePng(`${REVIEW}/produccion-vino.png`, preview(list, { cols: 6, cell: { w: geometry.width, h: geometry.height }, bg: [110, 20, 50], gap: 4 })); console.log(Object.keys(FRAMES).join(', ')); }
