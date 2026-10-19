import { readPng } from './png.mjs';
const sheets = { cuerpo: ['poses-cuerpo-storyboard', [[5,381],[387,765],[770,1150],[1155,1532]], [[5,509],[514,1019]]], cabeza: ['poses-cabeza-nueve', [[9,507],[518,1017],[1028,1527]], [[7,338],[347,677],[687,1015]]] };
for (const [kind, [file, xs, ys]] of Object.entries(sheets)) {
  const img = readPng(`assets-src/tutor/referencias/${file}.png`);
  const at = (x, y) => { const o = (y * img.width + x) * 4; return [img.data[o], img.data[o + 1], img.data[o + 2]]; };
  let n = 0;
  for (const [y0, y1] of ys) for (const [x0, x1] of xs) {
    n++;
    // fondo: muestra en la esquina superior derecha de la celda
    const bg = at(x1 - 14, y0 + 14), bg2 = at(x1 - 14, y1 - 14), bg3 = at(x0 + 14, y1 - 14);
    // gafas: píxeles dorados claros (r>180,g>150,b<130 y r-b>70)
    let gx0 = 1e9, gx1 = -1, gy0 = 1e9, gy1 = -1, count = 0;
    for (let y = y0 + 8; y < y1 - 8; y++) for (let x = x0 + 8; x < x1 - 8; x++) { const [r, g, b] = at(x, y); if (r > 170 && g > 140 && b < 150 && r - b > 55 && g - b > 35 && r - g < 60 && y < y0 + (y1 - y0) * 0.55) { count++; gx0 = Math.min(gx0, x); gx1 = Math.max(gx1, x); gy0 = Math.min(gy0, y); gy1 = Math.max(gy1, y); } }
    console.log(kind, n, 'bg', bg.join(','), '|', bg2.join(','), '|', bg3.join(','), 'gafas', count, count ? `x ${gx0 - x0}-${gx1 - x0} (w ${gx1 - gx0}) y ${gy0 - y0}-${gy1 - y0} (h ${gy1 - gy0})` : '');
  }
  // tamaño del bloque de píxel: longitudes de racha en una fila central del primer cuadro
  const [y0, y1] = ys[0], [x0, x1] = xs[0]; const row = Math.floor((y0 + y1) / 2) - 30; const runs = []; let run = 1;
  for (let x = x0 + 8; x < x1 - 8; x++) { const a = at(x, row), b = at(x + 1, row); if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 12) run++; else { runs.push(run); run = 1; } }
  console.log(kind, 'rachas fila', row, runs.slice(0, 60).join(' '));
}
