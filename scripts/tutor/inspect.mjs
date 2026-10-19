import { readPng } from './png.mjs';
for (const name of ['poses-cuerpo-storyboard', 'poses-cabeza-nueve', 'tutor-retrato-base']) {
  const img = readPng(`assets-src/tutor/referencias/${name}.png`);
  console.log(name, img.width + 'x' + img.height);
  const px = (x, y) => { const o = (y * img.width + x) * 4; return [img.data[o], img.data[o + 1], img.data[o + 2], img.data[o + 3]].join(','); };
  console.log('  esquinas/interior:', px(20, 60), px(img.width - 20, 60), px(Math.floor(img.width / 2), 20), px(60, img.height - 60));
  // columnas y filas oscuras (bordes de cuadrícula)
  const dark = (x, y) => { const o = (y * img.width + x) * 4; return img.data[o] + img.data[o + 1] + img.data[o + 2] < 200; };
  const cols = [], rows = [];
  for (let x = 0; x < img.width; x++) { let n = 0; for (let y = 0; y < img.height; y++) if (dark(x, y)) n++; if (n > img.height * 0.9) cols.push(x); }
  for (let y = 0; y < img.height; y++) { let n = 0; for (let x = 0; x < img.width; x++) if (dark(x, y)) n++; if (n > img.width * 0.9) rows.push(y); }
  console.log('  columnas-borde:', cols.join(' ')); console.log('  filas-borde:', rows.join(' '));
}
