import { mkdirSync } from 'node:fs';
import { readPng, writePng } from './png.mjs';
import { cropPanel, removeBackground, preview } from './extract.mjs';
const OUT = process.argv[2]; mkdirSync(OUT, { recursive: true });
const sheet = readPng('assets-src/tutor/referencias/poses-cabeza-nueve.png');
const xs = [[9, 507], [518, 1017], [1028, 1527]], ys = [[7, 338], [347, 677], [687, 1015]];
const frames = []; let n = 0;
for (const [y0, y1] of ys) for (const [x0, x1] of xs) {
  n++; const clean = removeBackground(cropPanel(sheet, x0 + 8, y0 + 8, x1 - 8, y1 - 8), { tol: 8 });
  frames.push(clean); let opaque = 0; for (let p = 3; p < clean.data.length; p += 4) if (clean.data[p]) opaque++;
  console.log('cabeza', n, `${clean.width}x${clean.height}`, 'bg', clean.bg.join(','), 'opacos', opaque);
}
writePng(`${OUT}/cabezas-vino.png`, preview(frames, { cols: 3, cell: { w: 482, h: 316 }, bg: [110, 20, 50] }));
