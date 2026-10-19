import { readPng } from './png.mjs';
const img = readPng('assets-src/tutor/referencias/poses-cabeza-nueve.png');
const at = (x, y) => { const o = (y * img.width + x) * 4; return [img.data[o], img.data[o + 1], img.data[o + 2]]; };
// Panel 1 de cabeza: origen (9,7). Recorre una línea horizontal por las gafas (y≈7+145).
for (const y of [7 + 128, 7 + 150, 7 + 175]) {
  const out = [];
  for (let x = 9 + 150; x < 9 + 370; x += 6) out.push(at(x, y).join('.'));
  console.log('y', y - 7, out.join(' '));
}
