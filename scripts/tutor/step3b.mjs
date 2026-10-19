import { mkdirSync } from 'node:fs';
import { readPng, writePng } from './png.mjs';
import { cropPanel, removeBackground, preview } from './extract.mjs';
import { clone, erase, hairAnchor, neckBottom, over, scale } from './compose.mjs';
const OUT = process.argv[2]; mkdirSync(OUT, { recursive: true });
const body = readPng('assets-src/tutor/referencias/poses-cuerpo-storyboard.png'), head = readPng('assets-src/tutor/referencias/poses-cabeza-nueve.png');
const bxs = [[5, 381], [387, 765], [770, 1150], [1155, 1532]], bys = [[5, 509], [514, 1019]];
const bodies = []; for (const [y0, y1] of bys) for (const [x0, x1] of bxs) bodies.push(removeBackground(cropPanel(body, x0 + 6, y0 + 6, x1 - 6, y1 - 6)));
const h1 = removeBackground(cropPanel(head, 9 + 8, 7 + 8, 507 - 8, 338 - 8), { tol: 8 });
function compose(base, headImg, { s = 0.76, nb = 252, nx = 0, eh = 188, ew = 125 }) {
  const a = hairAnchor(base), out = clone(base);
  erase(out, (x, y) => { const dy = y - a.top, dx = Math.abs(x - a.x); if (dy < eh && dx < ew) return true; if (dy >= eh && dy < eh + 62 && dx < 78 * (1 - Math.max(0, dy - eh - 12) / 50)) return true; return false; });
  const h = scale(headImg, s), n = neckBottom(h); over(out, h, Math.round(a.x + nx - n.x), Math.round(a.top + nb - n.y)); return out;
}
const variants = [{ nb: 252, ew: 95 }, { nb: 262, ew: 95 }, { nb: 270, ew: 95 }, { nb: 262, ew: 92, eh: 196 }, { nb: 268, ew: 92, eh: 200 }, { nb: 276, ew: 92, eh: 204 }];
writePng(`${OUT}/barrido-base7.png`, preview(variants.map((v) => compose(bodies[6], h1, v)), { cols: 3, cell: { w: 372, h: 330 }, bg: [250, 243, 229] }));
