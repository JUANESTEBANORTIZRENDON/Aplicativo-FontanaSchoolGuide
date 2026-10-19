// Recorta cada cuadro de una lámina de referencia y lo deja con transparencia real: sin fondo, sin número,
// sin borde de la lámina y sin rayitas de movimiento. Devuelve la figura como una imagen RGBA recortada.
import { readPng } from './png.mjs';

export function cropPanel(img, x0, y0, x1, y1) {
  const width = x1 - x0, height = y1 - y0; const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) img.data.copy(data, y * width * 4, ((y0 + y) * img.width + x0) * 4, ((y0 + y) * img.width + x1) * 4);
  return { width, height, data };
}

const dist = (data, o, bg) => Math.hypot(data[o] - bg[0], data[o + 1] - bg[1], data[o + 2] - bg[2]);

function components(mask, width, height) {
  const label = new Int32Array(width * height).fill(-1); const sizes = []; const stack = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || label[start] !== -1) continue;
    const id = sizes.length; let size = 0; stack.push(start); label[start] = id;
    while (stack.length) {
      const p = stack.pop(); size++; const x = p % width, y = (p / width) | 0;
      for (const q of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y > 0 ? p - width : -1, y < height - 1 ? p + width : -1]) {
        if (q >= 0 && mask[q] && label[q] === -1) { label[q] = id; stack.push(q); }
      }
    }
    sizes.push(size);
  }
  return { label, sizes };
}

// tol: distancia de color máxima al fondo; pocket: tamaño mínimo de un hueco de fondo encerrado.
export function removeBackground(panel, { tol = 9, pocket = 350, peel = 2, bg } = {}) {
  const { width, height, data } = panel;
  const bgColor = bg ?? [data[((8) * width + width - 10) * 4], data[((8) * width + width - 10) * 4 + 1], data[((8) * width + width - 10) * 4 + 2]];
  const like = new Uint8Array(width * height);
  for (let p = 0; p < like.length; p++) like[p] = dist(data, p * 4, bgColor) <= tol ? 1 : 0;
  // 1) fondo conectado con el borde del cuadro; 2) bolsillos de fondo encerrados (entre brazo y cuerpo)
  const { label, sizes } = components(like, width, height);
  const edgeLabels = new Set();
  for (let x = 0; x < width; x++) { for (const y of [0, height - 1]) { const l = label[y * width + x]; if (l >= 0) edgeLabels.add(l); } }
  for (let y = 0; y < height; y++) { for (const x of [0, width - 1]) { const l = label[y * width + x]; if (l >= 0) edgeLabels.add(l); } }
  const transparent = new Uint8Array(width * height);
  for (let p = 0; p < like.length; p++) { const l = label[p]; if (l >= 0 && (edgeLabels.has(l) || sizes[l] >= pocket)) transparent[p] = 1; }
  // 3) peeling: quita el halo claro junto al fondo (píxeles casi del color del fondo pegados a lo transparente)
  for (let pass = 0; pass < peel; pass++) {
    const next = Uint8Array.from(transparent);
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
      const p = y * width + x; if (transparent[p]) continue;
      if ((transparent[p - 1] || transparent[p + 1] || transparent[p - width] || transparent[p + width]) && dist(data, p * 4, bgColor) <= tol * 2.4) next[p] = 1;
    }
    transparent.set(next);
  }
  // 4) quedarse solo con la figura: la mayor componente opaca (descarta números y rayitas de movimiento)
  const solid = new Uint8Array(width * height); for (let p = 0; p < solid.length; p++) solid[p] = transparent[p] ? 0 : 1;
  const figure = components(solid, width, height); const best = figure.sizes.indexOf(Math.max(...figure.sizes));
  const out = Buffer.alloc(width * height * 4);
  for (let p = 0; p < solid.length; p++) if (figure.label[p] === best) { data.copy(out, p * 4, p * 4, p * 4 + 3); out[p * 4 + 3] = 255; }
  return { width, height, data: out, bg: bgColor };
}

export function trim(image, pad = 0) {
  const { width, height, data } = image; let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return { box: { x0: Math.max(0, x0 - pad), y0: Math.max(0, y0 - pad), x1: Math.min(width - 1, x1 + pad), y1: Math.min(height - 1, y1 + pad) } };
}

// Compone una imagen sobre un fondo de color para revisarla a simple vista.
export function preview(images, { cols, gap = 8, bg = [60, 18, 36], cell }) {
  const w = cell.w, h = cell.h; const rows = Math.ceil(images.length / cols);
  const sheet = { width: cols * (w + gap) + gap, height: rows * (h + gap) + gap, data: Buffer.alloc((cols * (w + gap) + gap) * (rows * (h + gap) + gap) * 4) };
  for (let p = 0; p < sheet.width * sheet.height; p++) { sheet.data[p * 4] = bg[0]; sheet.data[p * 4 + 1] = bg[1]; sheet.data[p * 4 + 2] = bg[2]; sheet.data[p * 4 + 3] = 255; }
  images.forEach((img, index) => {
    const ox = gap + (index % cols) * (w + gap), oy = gap + Math.floor(index / cols) * (h + gap);
    for (let y = 0; y < Math.min(img.height, h); y++) for (let x = 0; x < Math.min(img.width, w); x++) {
      const s = (y * img.width + x) * 4, d = ((oy + y) * sheet.width + ox + x) * 4, a = img.data[s + 3] / 255;
      for (let c = 0; c < 3; c++) sheet.data[d + c] = Math.round(img.data[s + c] * a + sheet.data[d + c] * (1 - a));
    }
  });
  return sheet;
}
export { readPng };
