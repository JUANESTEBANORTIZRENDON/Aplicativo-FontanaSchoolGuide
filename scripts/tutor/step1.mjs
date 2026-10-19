import { mkdirSync } from 'node:fs';
import { readPng, writePng } from './png.mjs';
import { cropPanel, removeBackground, preview } from './extract.mjs';
const OUT = process.argv[2]; mkdirSync(OUT, { recursive: true });
const body = readPng('assets-src/tutor/referencias/poses-cuerpo-storyboard.png');
const xs = [[5, 381], [387, 765], [770, 1150], [1155, 1532]], ys = [[5, 509], [514, 1019]];
const frames = []; let n = 0;
for (const [y0, y1] of ys) for (const [x0, x1] of xs) {
  n++; const panel = cropPanel(body, x0 + 6, y0 + 6, x1 - 6, y1 - 6);   // 6 px hacia dentro: fuera el borde de la lámina
  const clean = removeBackground(panel);
  frames.push(clean);
  let opaque = 0; for (let p = 3; p < clean.data.length; p += 4) if (clean.data[p]) opaque++;
  console.log('cuerpo', n, `${clean.width}x${clean.height}`, 'bg', clean.bg.join(','), 'opacos', opaque);
}
writePng(`${OUT}/cuerpo-vino.png`, preview(frames, { cols: 4, cell: { w: 372, h: 498 }, bg: [110, 20, 50] }));
writePng(`${OUT}/cuerpo-crema.png`, preview(frames, { cols: 4, cell: { w: 372, h: 498 }, bg: [250, 243, 229] }));
