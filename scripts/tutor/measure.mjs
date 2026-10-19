import { readPng } from './png.mjs';
import { cropPanel, removeBackground } from './extract.mjs';
const body = readPng('assets-src/tutor/referencias/poses-cuerpo-storyboard.png');
const head = readPng('assets-src/tutor/referencias/poses-cabeza-nueve.png');
function stats(frame, rowOffsets) {
  const { width, height, data } = frame; const solid = (x, y) => data[(y * width + x) * 4 + 3] > 0;
  let top = -1; for (let y = 0; y < height && top < 0; y++) for (let x = 0; x < width; x++) if (solid(x, y)) { top = y; break; }
  // centro de la cima del cabello: ancho de las primeras 14 filas, tomando la racha continua más ancha
  const centers = []; for (let y = top + 6; y < top + 20; y++) { let best = [0, 0]; let s = -1; for (let x = 0; x <= width; x++) { const on = x < width && solid(x, y); if (on && s < 0) s = x; if (!on && s >= 0) { if (x - s > best[1] - best[0]) best = [s, x]; s = -1; } } centers.push((best[0] + best[1]) / 2); }
  const ax = centers.reduce((a, b) => a + b) / centers.length;
  const widths = rowOffsets.map((dy) => { const y = top + dy; let l = Math.round(ax), r = Math.round(ax); while (l > 0 && solid(l - 1, y)) l--; while (r < width - 1 && solid(r + 1, y)) r++; return r - l + 1; });
  return { top, ax: Math.round(ax), widths };
}
const bxs = [[5, 381], [387, 765], [770, 1150], [1155, 1532]], bys = [[5, 509], [514, 1019]];
let n = 0; console.log('CUERPO (top, ancla x, ancho de cabeza a +90/+110/+130 px de la cima)');
for (const [y0, y1] of bys) for (const [x0, x1] of bxs) { n++; const f = removeBackground(cropPanel(body, x0 + 6, y0 + 6, x1 - 6, y1 - 6)); console.log(n, JSON.stringify(stats(f, [90, 110, 130]))); }
const hxs = [[9, 507], [518, 1017], [1028, 1527]], hys = [[7, 338], [347, 677], [687, 1015]]; n = 0; console.log('CABEZAS');
for (const [y0, y1] of hys) for (const [x0, x1] of hxs) { n++; const f = removeBackground(cropPanel(head, x0 + 8, y0 + 8, x1 - 8, y1 - 8), { tol: 8 }); console.log(n, JSON.stringify(stats(f, [120, 150, 180]))); }
