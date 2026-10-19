import { mkdirSync } from 'node:fs';
import { readPng, writePng } from './png.mjs';
import { cropPanel, removeBackground, preview } from './extract.mjs';
import { clone, erase, hairAnchor, neckBottom, over, scale } from './compose.mjs';
const OUT = process.argv[2]; mkdirSync(OUT, { recursive: true });
const P = JSON.parse(process.argv[3] ?? '{}');
const S = P.s ?? 0.76, NB = P.nb ?? 252, NX = P.nx ?? 0, EH = P.eh ?? 188, EW = P.ew ?? 125;
const body = readPng('assets-src/tutor/referencias/poses-cuerpo-storyboard.png'), head = readPng('assets-src/tutor/referencias/poses-cabeza-nueve.png');
const bxs = [[5, 381], [387, 765], [770, 1150], [1155, 1532]], bys = [[5, 509], [514, 1019]];
const bodies = []; for (const [y0, y1] of bys) for (const [x0, x1] of bxs) bodies.push(removeBackground(cropPanel(body, x0 + 6, y0 + 6, x1 - 6, y1 - 6)));
const hxs = [[9, 507], [518, 1017], [1028, 1527]], hys = [[7, 338], [347, 677], [687, 1015]];
const heads = []; for (const [y0, y1] of hys) for (const [x0, x1] of hxs) heads.push(removeBackground(cropPanel(head, x0 + 8, y0 + 8, x1 - 8, y1 - 8), { tol: 8 }));
function compose(base, headImg) {
  const a = hairAnchor(base), out = clone(base);
  // borra la cabeza original: bloque de la cabeza + el interior de la V del cuello (hasta donde llega la barba)
  erase(out, (x, y) => { const dy = y - a.top, dx = Math.abs(x - a.x); if (dy < EH && dx < EW) return true; if (dy >= EH && dy < EH + 62 && dx < 78 * (1 - Math.max(0, dy - EH - 12) / 50)) return true; return false; });
  const h = scale(headImg, S), nb = neckBottom(h);
  over(out, h, Math.round(a.x + NX - nb.x), Math.round(a.top + NB - nb.y));
  return out;
}
const set = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => compose(bodies[0], heads[i - 1]));
writePng(`${OUT}/compuesto-base1.png`, preview(set, { cols: 3, cell: { w: 372, h: 498 }, bg: [250, 243, 229] }));
const combos = [[4, 1], [4, 9], [4, 4], [5, 4], [5, 5], [6, 1], [7, 1], [7, 7], [7, 9]];
writePng(`${OUT}/compuesto-otros.png`, preview(combos.map(([b, h]) => compose(bodies[b - 1], heads[h - 1])), { cols: 3, cell: { w: 372, h: 498 }, bg: [250, 243, 229] }));
