// Utilidades de composición: remuestreo con alfa premultiplicado, borrado de la cabeza original y pegado de cabezas.
export const blank = (width, height) => ({ width, height, data: Buffer.alloc(width * height * 4) });

// Escala bilineal con alfa premultiplicado (bordes suaves, sin halos de color).
export function scale(img, factor) {
  const width = Math.max(1, Math.round(img.width * factor)), height = Math.max(1, Math.round(img.height * factor)); const out = blank(width, height);
  const px = (x, y, c) => { x = Math.min(img.width - 1, Math.max(0, x)); y = Math.min(img.height - 1, Math.max(0, y)); return img.data[(y * img.width + x) * 4 + c]; };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sx = (x + 0.5) / factor - 0.5, sy = (y + 0.5) / factor - 0.5; const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
    let a = 0; const c = [0, 0, 0];
    for (const [dx, dy, w] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) {
      const alpha = px(x0 + dx, y0 + dy, 3) / 255; a += alpha * w; for (let k = 0; k < 3; k++) c[k] += px(x0 + dx, y0 + dy, k) * alpha * w;
    }
    const o = (y * width + x) * 4; if (a > 0.02) { out.data[o] = Math.round(c[0] / a); out.data[o + 1] = Math.round(c[1] / a); out.data[o + 2] = Math.round(c[2] / a); out.data[o + 3] = Math.round(Math.min(1, a) * 255); }
  }
  return out;
}

// «Over»: pinta src sobre dst en (ox, oy).
export function over(dst, src, ox, oy) {
  for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
    const dx = x + ox, dy = y + oy; if (dx < 0 || dy < 0 || dx >= dst.width || dy >= dst.height) continue;
    const s = (y * src.width + x) * 4, d = (dy * dst.width + dx) * 4, sa = src.data[s + 3] / 255; if (!sa) continue;
    const da = dst.data[d + 3] / 255, oa = sa + da * (1 - sa);
    for (let k = 0; k < 3; k++) dst.data[d + k] = Math.round((src.data[s + k] * sa + dst.data[d + k] * da * (1 - sa)) / oa);
    dst.data[d + 3] = Math.round(oa * 255);
  }
}

export function clone(img) { return { width: img.width, height: img.height, data: Buffer.from(img.data) }; }

// Borra (alfa 0) los píxeles para los que inside(x, y) es verdadero.
export function erase(img, inside) { for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (inside(x, y)) img.data[(y * img.width + x) * 4 + 3] = 0; }

// Centro del cuello de una cabeza: mitad de la última fila opaca ancha.
export function neckBottom(img) {
  const solid = (x, y) => img.data[(y * img.width + x) * 4 + 3] > 0;
  let bottom = -1; for (let y = img.height - 1; y >= 0 && bottom < 0; y--) { let n = 0; for (let x = 0; x < img.width; x++) if (solid(x, y)) n++; if (n > 30) bottom = y; }
  let l = img.width, r = -1; for (let x = 0; x < img.width; x++) if (solid(x, bottom)) { l = Math.min(l, x); r = Math.max(r, x); }
  return { x: (l + r) / 2, y: bottom, width: r - l + 1 };
}
export function hairAnchor(img) {
  const solid = (x, y) => img.data[(y * img.width + x) * 4 + 3] > 0; let top = -1; for (let y = 0; y < img.height && top < 0; y++) for (let x = 0; x < img.width; x++) if (solid(x, y)) { top = y; break; }
  const cs = []; for (let y = top + 6; y < top + 20; y++) { let best = [0, 0], s = -1; for (let x = 0; x <= img.width; x++) { const on = x < img.width && solid(x, y); if (on && s < 0) s = x; if (!on && s >= 0) { if (x - s > best[1] - best[0]) best = [s, x]; s = -1; } } cs.push((best[0] + best[1]) / 2); }
  return { x: cs.reduce((a, b) => a + b) / cs.length, top };
}
