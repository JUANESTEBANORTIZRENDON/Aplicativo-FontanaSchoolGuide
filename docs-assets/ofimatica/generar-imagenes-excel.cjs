// Genera las ilustraciones de Excel (lecciones y preguntas de la evaluación) imitando la ventana real de Excel.
// Uso: node docs-assets/ofimatica/generar-imagenes-excel.cjs src/office/imagenes
const fs = require('fs');
const path = require('path');
const out = process.argv[2];
if (!out) throw new Error('Indica la carpeta de salida.');
fs.mkdirSync(out, { recursive: true });

const W = 1280, H = 720;
const X = { green: '#217346', greenDark: '#185c37', greenSoft: '#e9f3ee', ribbon: '#f3f3f3', grid: '#d4d4d4', head: '#efefef', headSel: '#d3e8dc', text: '#1f1f1f', muted: '#5f6368', blue: '#1a56b0', gold: '#d4af37', wine: '#8b1538' };
const FONT = "Segoe UI, Calibri, Arial, sans-serif";
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const t = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-family="${o.font ?? FONT}" font-size="${o.size ?? 13}" font-weight="${o.weight ?? 400}" fill="${o.fill ?? X.text}" text-anchor="${o.anchor ?? 'start'}"${o.italic ? ' font-style="italic"' : ''}>${esc(s)}</text>`;
const r = (x, y, w, h, fill, o = {}) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r ?? 0}" fill="${fill}" stroke="${o.stroke ?? 'none'}" stroke-width="${o.sw ?? 0}"/>`;

// ---- Cinta de opciones -------------------------------------------------------------------------------
const TABS = ['Archivo', 'Inicio', 'Insertar', 'Disposición de página', 'Fórmulas', 'Datos', 'Revisar', 'Vista', 'Ayuda'];

function button(x, y, label, icon, o = {}) {
  const hl = o.highlight ? `${r(x - 4, y - 4, o.w ?? 64, 74, '#fff4cc', { r: 6, stroke: X.gold, sw: 2.5 })}` : '';
  return `${hl}<g>${icon(x + (o.w ?? 64) / 2 - 4, y + 4)}</g>${t(x + (o.w ?? 64) / 2 - 4, y + 58, label, { size: 11.5, anchor: 'middle' })}`;
}
const ico = {
  paste: (cx, y) => `${r(cx - 14, y + 2, 28, 34, '#c8a25e', { r: 3 })}${r(cx - 9, y + 8, 18, 24, '#fff', { r: 2 })}${r(cx - 6, y - 1, 12, 6, '#7a7a7a', { r: 2 })}`,
  sum: (cx, y) => t(cx, y + 32, 'Σ', { size: 34, weight: 700, fill: X.text, anchor: 'middle' }),
  sort: (cx, y) => `${t(cx - 8, y + 16, 'A', { size: 13, weight: 700, fill: X.blue, anchor: 'middle' })}${t(cx - 8, y + 34, 'Z', { size: 13, weight: 700, fill: X.text, anchor: 'middle' })}<path d="M${cx + 8} ${y + 6} v26 m-6 -7 l6 7 l6 -7" stroke="${X.text}" stroke-width="2" fill="none"/>`,
  sortDesc: (cx, y) => `${t(cx - 8, y + 16, 'Z', { size: 13, weight: 700, fill: X.text, anchor: 'middle' })}${t(cx - 8, y + 34, 'A', { size: 13, weight: 700, fill: X.blue, anchor: 'middle' })}<path d="M${cx + 8} ${y + 6} v26 m-6 -7 l6 7 l6 -7" stroke="${X.text}" stroke-width="2" fill="none"/>`,
  filter: (cx, y) => `<path d="M${cx - 15} ${y + 6} h30 l-11 13 v13 l-8 -5 v-8 z" fill="#4a7ebb" stroke="#2c5d94" stroke-width="1.5"/>`,
  find: (cx, y) => `<circle cx="${cx - 3}" cy="${y + 15}" r="10" fill="none" stroke="${X.text}" stroke-width="3"/><path d="M${cx + 4} ${y + 22} l10 10" stroke="${X.text}" stroke-width="4" stroke-linecap="round"/>`,
  currency: (cx, y) => `${r(cx - 16, y + 6, 32, 26, '#eaf2e2', { r: 3, stroke: '#7aa35a', sw: 1.5 })}${t(cx, y + 26, '$', { size: 18, weight: 700, fill: '#3d6b1f', anchor: 'middle' })}`,
};

function ribbon(tab, groups) {
  const tabBar = TABS.map((name, i) => {
    const x = 14 + TABS.slice(0, i).reduce((sum, item) => sum + item.length * 7.6 + 26, 0);
    const w = name.length * 7.6 + 18;
    if (name === tab) return `${r(x, 40, w, 28, X.ribbon)}${t(x + w / 2, 59, name, { size: 13, weight: 600, fill: X.green, anchor: 'middle' })}`;
    return t(x + w / 2, 59, name, { size: 13, fill: '#fff', anchor: 'middle' });
  }).join('');
  let gx = 18;
  const body = groups.map((group) => {
    const start = gx;
    const inner = group.items.map((item) => { const s = item.render(gx); gx += item.w ?? 70; return s; }).join('');
    const width = gx - start;
    const s = `${inner}${t(start + width / 2, 160, group.name, { size: 11, fill: X.muted, anchor: 'middle' })}<line x1="${gx + 6}" y1="76" x2="${gx + 6}" y2="164" stroke="#d6d6d6" stroke-width="1"/>`;
    gx += 16;
    return s;
  }).join('');
  return `${r(0, 34, W, 34, X.green)}${tabBar}${r(0, 68, W, 100, X.ribbon)}${body}<line x1="0" y1="168" x2="${W}" y2="168" stroke="#d6d6d6"/>`;
}

const G = {
  portapapeles: (o = {}) => ({ name: 'Portapapeles', items: [
    { w: 66, render: (x) => button(x, 80, 'Pegar', ico.paste, { highlight: o.paste }) },
    { w: 84, render: (x) => `${hl(x, 78, 80, 24, o.cut)}${t(x + 4, 95, '✂ Cortar', { size: 12.5 })}${hl(x, 104, 80, 24, o.copy)}${t(x + 4, 121, '⧉ Copiar', { size: 12.5 })}${t(x + 4, 147, '🖌 Copiar formato', { size: 11.5, fill: X.muted })}` },
  ] }),
  fuente: () => ({ name: 'Fuente', items: [{ w: 170, render: (x) => `${r(x, 82, 104, 24, '#fff', { stroke: '#c8c8c8', sw: 1 })}${t(x + 6, 99, 'Calibri', { size: 12.5 })}${r(x + 110, 82, 40, 24, '#fff', { stroke: '#c8c8c8', sw: 1 })}${t(x + 118, 99, '11', { size: 12.5 })}${t(x + 4, 136, 'N', { size: 15, weight: 800 })}${t(x + 30, 136, 'K', { size: 15, italic: true })}${t(x + 56, 136, 'S', { size: 15 })}<line x1="${x + 55}" y1="139" x2="${x + 66}" y2="139" stroke="${X.text}"/>` }] }),
  numero: (o = {}) => ({ name: 'Número', items: [{ w: 150, render: (x) => `${r(x, 82, 138, 24, '#fff', { stroke: '#c8c8c8', sw: 1 })}${t(x + 6, 99, o.format ?? 'General', { size: 12.5 })}${hl(x, 112, 34, 32, o.currency)}<g>${ico.currency(x + 17, 110)}</g>${t(x + 52, 134, '%', { size: 16, weight: 700 })}${t(x + 80, 134, '000', { size: 12 })}` }] }),
  edicion: (o = {}) => ({ name: 'Edición', items: [
    { w: 74, render: (x) => button(x, 80, 'Autosuma', ico.sum, { highlight: o.sum, w: 74 }) },
    { w: 106, render: (x) => button(x, 80, 'Ordenar y filtrar', ico.filter, { highlight: o.filter, w: 106 }) },
    { w: 122, render: (x) => button(x, 80, 'Buscar y seleccionar', ico.find, { highlight: o.find, w: 122 }) },
  ] }),
  datosOrden: (o = {}) => ({ name: 'Ordenar y filtrar', items: [
    { w: 70, render: (x) => button(x, 80, 'De A a Z', ico.sort, { highlight: o.asc }) },
    { w: 70, render: (x) => button(x, 80, 'De Z a A', ico.sortDesc, { highlight: o.desc }) },
    { w: 70, render: (x) => button(x, 80, 'Filtro', ico.filter, { highlight: o.filter }) },
  ] }),
  datosHerr: () => ({ name: 'Herramientas de datos', items: [{ w: 210, render: (x) => `${t(x + 6, 100, '▦ Texto en columnas', { size: 12.5 })}${t(x + 6, 124, '⊟ Quitar duplicados', { size: 12.5 })}${t(x + 6, 148, '☑ Validación de datos', { size: 12.5, fill: X.muted })}` }] }),
};
function hl(x, y, w, h, on) { return on ? r(x - 2, y - 2, w + 4, h + 4, '#fff4cc', { r: 5, stroke: X.gold, sw: 2.5 }) : ''; }

// ---- Ventana completa ----------------------------------------------------------------------------------
// cols: [{ letter, w }]; rows: arreglos de celdas (texto o { v, align, bold, fill, color }).
function excel({ title = 'Gestiones de cobranza.xlsx', tab = 'Inicio', groups, nameBox, formula, cols, rows, select, headerRow = true, filterCols = [], sortCol, status, overlay = '' }) {
  const colX = []; let cx = 46; for (const col of cols) { colX.push(cx); cx += col.w; }
  const gridTop = 214, rowH = 30, colHead = 24;
  const numRows = 14;
  let s = '';
  // Barra de título.
  s += `${r(0, 0, W, 34, X.green)}<g fill="#fff">${r(14, 9, 16, 16, 'none', { r: 2, stroke: '#fff', sw: 1.6 })}<path d="M18 13 h8 v8 h-8 z" fill="#fff" opacity=".85"/></g>${t(40, 22, 'Autoguardado', { size: 12, fill: '#e8f5ee' })}${r(124, 11, 28, 14, '#185c37', { r: 7 })}<circle cx="132" cy="18" r="5" fill="#fff"/>${t(W / 2, 22, `${title} - Excel`, { size: 13, fill: '#fff', anchor: 'middle' })}${t(W - 108, 23, '—', { size: 14, fill: '#fff' })}${r(W - 72, 12, 11, 11, 'none', { stroke: '#fff', sw: 1.4 })}${t(W - 30, 23, '✕', { size: 14, fill: '#fff' })}`;
  s += ribbon(tab, groups);
  // Barra de fórmulas.
  s += `${r(0, 168, W, 40, '#fff')}${r(8, 176, 92, 24, '#fff', { stroke: '#c8c8c8', sw: 1 })}${t(16, 193, nameBox ?? '', { size: 13 })}${t(110, 194, '⋮', { size: 14, fill: X.muted })}${t(126, 194, '✕', { size: 13, fill: X.muted })}${t(146, 194, '✓', { size: 14, fill: X.muted })}${t(168, 194, 'fx', { size: 14, italic: true, fill: X.muted, font: 'Times New Roman, serif' })}${r(194, 176, W - 202, 24, '#fff', { stroke: '#c8c8c8', sw: 1 })}${t(202, 193, formula ?? '', { size: 13.5 })}<line x1="0" y1="208" x2="${W}" y2="208" stroke="#d6d6d6"/>`;
  // Encabezados de columnas y filas.
  s += r(0, 208, W, colHead + 6, X.head);
  s += r(0, gridTop, 46, colHead, X.head) + `<path d="M40 ${gridTop + 18} l0 -10 l-10 10 z" fill="#b8b8b8"/>`;
  cols.forEach((col, i) => {
    const sel = select && select.col === i;
    s += r(colX[i], gridTop, col.w, colHead, sel ? X.headSel : X.head) + `<line x1="${colX[i]}" y1="${gridTop}" x2="${colX[i]}" y2="${gridTop + colHead}" stroke="#c6c6c6"/>` + t(colX[i] + col.w / 2, gridTop + 17, col.letter, { size: 12.5, anchor: 'middle', fill: sel ? X.greenDark : '#444', weight: sel ? 700 : 400 });
    if (sel) s += `<line x1="${colX[i]}" y1="${gridTop + colHead - 1}" x2="${colX[i] + col.w}" y2="${gridTop + colHead - 1}" stroke="${X.green}" stroke-width="2.5"/>`;
  });
  const rest = colX[cols.length - 1] + cols[cols.length - 1].w;
  s += r(rest, gridTop, W - rest, colHead, X.head);
  const top = gridTop + colHead;
  for (let i = 0; i < numRows; i++) {
    const y = top + i * rowH;
    const sel = select && select.row === i;
    s += r(0, y, 46, rowH, sel ? X.headSel : X.head) + t(23, y + 20, String(i + 1), { size: 12, anchor: 'middle', fill: sel ? X.greenDark : '#444', weight: sel ? 700 : 400 });
    s += r(46, y, W - 46, rowH, '#fff') + `<line x1="46" y1="${y + rowH}" x2="${W}" y2="${y + rowH}" stroke="${X.grid}"/>`;
  }
  for (let i = 0; i <= cols.length; i++) { const x = i < cols.length ? colX[i] : rest; s += `<line x1="${x}" y1="${top}" x2="${x}" y2="${top + numRows * rowH}" stroke="${X.grid}"/>`; }
  // Celdas.
  rows.forEach((row, ri) => {
    const y = top + ri * rowH;
    row.forEach((cell, ci) => {
      if (cell === null || cell === undefined || cell === '') return;
      const c = typeof cell === 'object' ? cell : { v: cell };
      const isHead = headerRow && ri === 0;
      if (c.fill || isHead) s += r(colX[ci] + 1, y + 1, cols[ci].w - 1, rowH - 1, c.fill ?? '#dce9f5');
      const align = c.align ?? (typeof c.v === 'number' || /^[\d$=.,\s-]+$/.test(String(c.v)) && !isHead ? 'end' : 'start');
      const x = align === 'end' ? colX[ci] + cols[ci].w - 8 : colX[ci] + 7;
      s += t(x, y + 20, c.v, { size: 13.5, anchor: align, weight: c.bold || isHead ? 700 : 400, fill: c.color ?? X.text });
      if (isHead && filterCols.includes(ci)) s += `${r(colX[ci] + cols[ci].w - 22, y + 6, 17, 17, '#fff', { r: 2, stroke: '#a6a6a6', sw: 1 })}<path d="M${colX[ci] + cols[ci].w - 18} ${y + 12} h9 l-4.5 6 z" fill="#555"/>`;
      if (isHead && sortCol === ci) s += `<path d="M${colX[ci] + cols[ci].w - 34} ${y + 9} v12 m-4 -4 l4 4 l4 -4" stroke="${X.blue}" stroke-width="1.8" fill="none"/>`;
    });
  });
  // Selección.
  if (select) {
    const x = colX[select.col], y = top + select.row * rowH;
    const w = select.w ? cols.slice(select.col, select.col + select.w).reduce((a, c) => a + c.w, 0) : cols[select.col].w;
    const h = (select.h ?? 1) * rowH;
    if (select.range) s += r(x, y, w, h, '#d3e8dc', {}) + rows.slice(select.row, select.row + (select.h ?? 1)).map((row, k) => { const c = row[select.col]; const v = typeof c === 'object' && c ? c.v : c; return v ? t(x + w - 8, y + k * rowH + 20, v, { size: 13.5, anchor: 'end' }) : ''; }).join('');
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${X.green}" stroke-width="2.5"/>${r(x + w - 4, y + h - 4, 7, 7, X.green)}`;
    if (select.marching) s += `<rect x="${select.marching.x}" y="${select.marching.y}" width="${select.marching.w}" height="${rowH}" fill="none" stroke="${X.green}" stroke-width="2" stroke-dasharray="6 4"/>`;
  }
  // Hojas y barra de estado.
  const sy = top + numRows * rowH;
  s += `${r(0, sy, W, 28, '#f3f3f3')}${t(18, sy + 19, '◀  ▶', { size: 11, fill: X.muted })}${r(70, sy, 86, 28, '#fff')}<line x1="70" y1="${sy + 26}" x2="156" y2="${sy + 26}" stroke="${X.green}" stroke-width="3"/>${t(113, sy + 19, 'Hoja1', { size: 13, weight: 700, fill: X.green, anchor: 'middle' })}${t(178, sy + 19, '⊕', { size: 16, fill: X.muted })}`;
  s += `${r(0, sy + 28, W, H - sy - 28, X.green)}${t(14, sy + 46, 'Listo', { size: 12, fill: '#fff' })}${status ? t(W - 230, sy + 46, status, { size: 12, fill: '#fff', anchor: 'end' }) : ''}${t(W - 70, sy + 46, '— ━━━ + 100 %', { size: 11, fill: '#fff', anchor: 'middle' })}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">${r(0, 0, W, H, '#fff')}${s}${overlay}</svg>\n`;
}

// ---- Elementos superpuestos ----------------------------------------------------------------------------
function keycap(x, y, label, w = 74) {
  return `${r(x, y + 5, w, 56, '#9aa3b2', { r: 10 })}${r(x, y, w, 56, '#fff', { r: 10, stroke: '#c5ccd8', sw: 2 })}${t(x + w / 2, y + 36, label, { size: 22, weight: 700, fill: '#192840', anchor: 'middle' })}`;
}
function shortcut(x, y, keys, caption) {
  const widths = keys.map((key) => (key.length > 2 ? 92 : 64));
  const total = widths.reduce((a, b) => a + b, 0) + (keys.length - 1) * 38 + 48;
  let s = `${r(x, y, Math.max(total, caption.length * 10 + 40), 128, '#192840', { r: 18 })}`;
  let kx = x + 24;
  keys.forEach((key, i) => { s += keycap(kx, y + 18, key, widths[i]); kx += widths[i]; if (i < keys.length - 1) { s += t(kx + 19, y + 56, '+', { size: 26, weight: 700, fill: X.gold, anchor: 'middle' }); kx += 38; } });
  s += t(x + 24, y + 110, caption, { size: 16, weight: 600, fill: '#fff' });
  return s;
}
function callout(x, y, text, w) {
  return `${r(x, y, w ?? text.length * 9.2 + 36, 44, X.wine, { r: 12 })}${t(x + 18, y + 28, text, { size: 16, weight: 700, fill: '#fff' })}`;
}
function findDialog(x, y, value) {
  return `<g>${r(x + 6, y + 8, 470, 230, '#00000022', { r: 6 })}${r(x, y, 470, 230, '#fff', { r: 6, stroke: '#9c9c9c', sw: 1 })}${t(x + 16, y + 26, 'Buscar y reemplazar', { size: 13.5, weight: 600 })}${t(x + 446, y + 26, '✕', { size: 13, fill: X.muted })}
    ${t(x + 20, y + 62, 'Buscar', { size: 13, weight: 700, fill: X.green })}<line x1="${x + 16}" y1="${y + 68}" x2="${x + 66}" y2="${y + 68}" stroke="${X.green}" stroke-width="2.5"/>${t(x + 90, y + 62, 'Reemplazar', { size: 13, fill: X.muted })}<line x1="${x + 10}" y1="${y + 70}" x2="${x + 460}" y2="${y + 70}" stroke="#e0e0e0"/>
    ${t(x + 20, y + 106, 'Buscar:', { size: 13 })}${r(x + 86, y + 88, 360, 26, '#fff', { stroke: X.green, sw: 1.6 })}${t(x + 94, y + 106, value, { size: 13.5 })}
    ${r(x + 136, y + 182, 112, 28, '#fff', { r: 3, stroke: '#9c9c9c', sw: 1 })}${t(x + 192, y + 201, 'Buscar todos', { size: 12.5, anchor: 'middle' })}${r(x + 258, y + 182, 112, 28, X.green, { r: 3 })}${t(x + 314, y + 201, 'Buscar siguiente', { size: 12.5, anchor: 'middle', fill: '#fff' })}${r(x + 380, y + 182, 74, 28, '#fff', { r: 3, stroke: '#9c9c9c', sw: 1 })}${t(x + 417, y + 201, 'Cerrar', { size: 12.5, anchor: 'middle' })}</g>`;
}
function filterMenu(x, y, items) {
  const h = 196 + items.length * 26;
  let s = `${r(x + 5, y + 6, 280, h, '#00000022', { r: 4 })}${r(x, y, 280, h, '#fff', { r: 4, stroke: '#9c9c9c', sw: 1 })}`;
  s += `${t(x + 16, y + 26, '↑ Ordenar de A a Z', { size: 13 })}${t(x + 16, y + 52, '↓ Ordenar de Z a A', { size: 13 })}<line x1="${x + 8}" y1="${y + 66}" x2="${x + 272}" y2="${y + 66}" stroke="#e0e0e0"/>${t(x + 16, y + 90, 'Filtros de texto  ›', { size: 13, fill: X.muted })}`;
  s += `${r(x + 14, y + 104, 252, 26, '#fff', { stroke: '#c8c8c8', sw: 1 })}${t(x + 22, y + 122, 'Buscar', { size: 12.5, fill: '#9a9a9a' })}`;
  items.forEach(([label, on], i) => {
    const iy = y + 146 + i * 26;
    s += `${r(x + 22, iy, 15, 15, on ? X.green : '#fff', { r: 2, stroke: on ? X.green : '#8a8a8a', sw: 1.4 })}${on ? `<path d="M${x + 25} ${iy + 8} l3.5 3.5 l6 -7" stroke="#fff" stroke-width="2" fill="none"/>` : ''}${t(x + 46, iy + 13, label, { size: 13, weight: on && i > 0 ? 700 : 400 })}`;
  });
  const by = y + h - 42;
  s += `${r(x + 92, by, 82, 28, X.green, { r: 3 })}${t(x + 133, by + 19, 'Aceptar', { size: 12.5, anchor: 'middle', fill: '#fff' })}${r(x + 184, by, 82, 28, '#fff', { r: 3, stroke: '#9c9c9c', sw: 1 })}${t(x + 225, by + 19, 'Cancelar', { size: 12.5, anchor: 'middle' })}`;
  return s;
}

// ---- Datos de ejemplo ---------------------------------------------------------------------------------
const COLS4 = [{ letter: 'A', w: 150 }, { letter: 'B', w: 210 }, { letter: 'C', w: 160 }, { letter: 'D', w: 190 }, { letter: 'E', w: 170 }, { letter: 'F', w: 150 }, { letter: 'G', w: 120 }];
const CLIENTES = [
  ['Cédula', 'Nombre', 'Teléfono', 'Empresa', 'Ciudad'],
  [{ v: '1032456789', align: 'start' }, 'Laura Gómez', { v: '300 456 7788', align: 'start' }, 'Banco Andino', 'Bogotá'],
  [{ v: '80123456', align: 'start' }, 'Carlos Ruiz', { v: '311 220 9911', align: 'start' }, 'Crediexpress', 'Medellín'],
  [{ v: '52987654', align: 'start' }, 'Marta Díaz', { v: '315 774 1020', align: 'start' }, 'Banco Andino', 'Cali'],
  [{ v: '1020334455', align: 'start' }, 'Jorge Peña', { v: '320 118 4456', align: 'start' }, 'Finanzas Sur', 'Bogotá'],
  [{ v: '43765981', align: 'start' }, 'Ana Torres', { v: '301 665 2290', align: 'start' }, 'Banco Andino', 'Barranquilla'],
  [{ v: '79456123', align: 'start' }, 'Luis Mora', { v: '312 909 7731', align: 'start' }, 'Crediexpress', 'Bogotá'],
];
const PAGOS = [
  ['Cliente', 'Pago del día'],
  ['Laura Gómez', '$ 250.000'], ['Carlos Ruiz', '$ 180.000'], ['Marta Díaz', '$ 320.000'], ['Jorge Peña', '$ 95.000'], ['Ana Torres', '$ 410.000'],
];
const COLS_PAGOS = [{ letter: 'A', w: 220 }, { letter: 'B', w: 190 }, { letter: 'C', w: 160 }, { letter: 'D', w: 160 }, { letter: 'E', w: 160 }, { letter: 'F', w: 150 }, { letter: 'G', w: 150 }];
const LLAMADAS = [
  ['Cliente', 'Fecha', 'Hora', 'Motivo'],
  ['Laura Gómez', { v: '16/10/2026', align: 'end' }, { v: '09:30', align: 'end' }, 'Confirmar pago'],
  ['Carlos Ruiz', { v: '17/10/2026', align: 'end' }, { v: '11:00', align: 'end' }, 'Enviar soporte'],
  ['Marta Díaz', { v: '20/10/2026', align: 'end' }, { v: '15:45', align: 'end' }, 'Revisar acuerdo'],
  ['Jorge Peña', { v: '22/10/2026', align: 'end' }, { v: '10:15', align: 'end' }, 'Recordar cuota'],
  ['Ana Torres', { v: '27/10/2026', align: 'end' }, { v: '16:00', align: 'end' }, 'Validar dirección'],
];
const COLS_LLAMADAS = [{ letter: 'A', w: 220 }, { letter: 'B', w: 160 }, { letter: 'C', w: 110 }, { letter: 'D', w: 230 }, { letter: 'E', w: 170 }, { letter: 'F', w: 170 }, { letter: 'G', w: 150 }];
const inicio = (o = {}) => [G.portapapeles(o), G.fuente(), G.numero(o), G.edicion(o)];
const datos = (o = {}) => [G.datosOrden(o), G.datosHerr()];

const pagosConTotal = (total) => [...PAGOS, [{ v: 'Total', bold: true }, total]];

const images = {
  // ---------------- Lecciones
  'excel-busquedas.svg': excel({
    tab: 'Inicio', groups: inicio({ find: true }), nameBox: 'A4', formula: '52987654', cols: COLS4, rows: CLIENTES, filterCols: [0, 1, 2, 3, 4],
    select: { row: 3, col: 0 }, overlay: findDialog(770, 250, '52987654') + shortcut(800, 520, ['Ctrl', 'B'], 'Abre Buscar'),
  }),
  'excel-ordenar.svg': excel({
    tab: 'Datos', groups: datos({ asc: true }), nameBox: 'B2', formula: '16/10/2026', cols: COLS_LLAMADAS, rows: LLAMADAS, filterCols: [0, 1, 2, 3], sortCol: 1,
    select: { row: 1, col: 1 }, overlay: callout(830, 300, '↑ La fecha más próxima queda arriba', 360),
  }),
  'excel-formulas.svg': excel({
    tab: 'Inicio', groups: inicio({ sum: true }), nameBox: 'B7', formula: '=SUMA(B2:B6)', cols: COLS_PAGOS, rows: pagosConTotal({ v: '$ 1.255.000', bold: true }),
    select: { row: 6, col: 1 }, status: 'Suma: $ 1.255.000', overlay: callout(470, 400, '=SUMA(B2:B6) suma todo el rango', 330),
  }),
  'excel-atajos.svg': excel({
    tab: 'Inicio', groups: inicio(), nameBox: 'C2', formula: '300 456 7788', cols: COLS4, rows: CLIENTES.slice(0, 3), select: { row: 1, col: 2 },
    overlay: `${r(60, 330, 1160, 300, '#ffffffee', { r: 20, stroke: '#e3e7ee', sw: 2 })}`
      + [['C', 'Copiar'], ['V', 'Pegar'], ['X', 'Cortar'], ['Z', 'Deshacer'], ['B', 'Buscar'], ['G', 'Guardar']].map(([key, label], i) => {
        const x = 90 + (i % 3) * 375, y = 352 + Math.floor(i / 3) * 140;
        return `${keycap(x, y, 'Ctrl', 92)}${t(x + 111, y + 38, '+', { size: 24, weight: 700, fill: X.gold, anchor: 'middle' })}${keycap(x + 130, y, key, 64)}${t(x + 214, y + 36, label, { size: 20, weight: 700, fill: '#192840' })}`;
      }).join(''),
  }),

  // ---------------- Preguntas de la evaluación
  'excel-q-suma.svg': excel({
    tab: 'Inicio', groups: inicio(), nameBox: 'B7', formula: '', cols: COLS_PAGOS, rows: [...PAGOS, [{ v: 'Total', bold: true }, '']],
    select: { row: 6, col: 1 }, overlay: callout(430, 420, '¿Qué escribes en B7?', 230),
  }),
  'excel-q-resta.svg': excel({
    tab: 'Inicio', groups: inicio(), nameBox: 'E2', formula: '', cols: [{ letter: 'A', w: 200 }, { letter: 'B', w: 170 }, { letter: 'C', w: 150 }, { letter: 'D', w: 150 }, { letter: 'E', w: 150 }, { letter: 'F', w: 190 }, { letter: 'G', w: 150 }],
    rows: [['Cliente', 'Saldo', 'Meta', 'Recaudo', 'Faltante'], ['Laura Gómez', '$ 1.200.000', '$ 400.000', '$ 250.000', ''], ['Carlos Ruiz', '$ 900.000', '$ 300.000', '$ 300.000', '']],
    select: { row: 1, col: 4 }, overlay: callout(800, 330, 'Meta (C2) menos recaudo (D2)', 320),
  }),
  'excel-q-autosuma.svg': excel({
    tab: 'Inicio', groups: inicio({ sum: true }), nameBox: 'B7', formula: '=SUMA(B2:B6)', cols: COLS_PAGOS, rows: [...PAGOS, [{ v: 'Total', bold: true }, { v: '=SUMA(B2:B6)', align: 'start' }]],
    select: { row: 1, col: 1, h: 5, marching: null }, status: 'Promedio: $ 251.000   Recuento: 5   Suma: $ 1.255.000',
    overlay: `<rect x="266" y="268" width="190" height="150" fill="none" stroke="${X.green}" stroke-width="2" stroke-dasharray="6 4"/>` + callout(500, 450, 'Σ Autosuma propone el rango de arriba', 380),
  }),
  'excel-q-filtro.svg': excel({
    tab: 'Datos', groups: datos({ filter: true }), nameBox: 'D1', formula: 'Empresa', cols: COLS4, rows: CLIENTES, filterCols: [0, 1, 2, 3, 4],
    select: { row: 0, col: 3 }, overlay: filterMenu(560, 268, [['(Seleccionar todo)', false], ['Banco Andino', true], ['Crediexpress', false], ['Finanzas Sur', false]]),
  }),
  'excel-q-buscar.svg': excel({
    tab: 'Inicio', groups: inicio(), nameBox: 'A1', formula: 'Cédula', cols: COLS4, rows: CLIENTES, select: { row: 0, col: 0 },
    overlay: findDialog(760, 250, '43765981') + callout(760, 520, '¿Qué atajo abre esta ventana?', 330),
  }),
  'excel-q-ordenar.svg': excel({
    tab: 'Datos', groups: datos(), nameBox: 'B1', formula: 'Fecha', cols: COLS_LLAMADAS, rows: [LLAMADAS[0], LLAMADAS[4], LLAMADAS[2], LLAMADAS[5], LLAMADAS[1], LLAMADAS[3]],
    select: { row: 0, col: 1 }, overlay: callout(860, 300, 'Fechas desordenadas', 230),
  }),
  'excel-q-copiar.svg': excel({
    tab: 'Inicio', groups: inicio({ copy: true }), nameBox: 'C2', formula: '300 456 7788', cols: COLS4,
    rows: [...CLIENTES.slice(0, 3), [], [{ v: 'Teléfono para llamar:', bold: true }, '', '']], select: { row: 4, col: 2, marching: { x: 406, y: 268, w: 160 } },
    overlay: callout(600, 420, 'El teléfono debe quedar en las dos celdas', 400),
  }),
  'excel-q-deshacer.svg': excel({
    tab: 'Inicio', groups: inicio(), nameBox: 'B3', formula: '', cols: [{ letter: 'A', w: 210 }, { letter: 'B', w: 170 }, { letter: 'C', w: 150 }, { letter: 'D', w: 160 }, { letter: 'E', w: 170 }, { letter: 'F', w: 160 }, { letter: 'G', w: 150 }],
    rows: [['Cliente', 'Valor acuerdo', 'Estado', 'Fecha'], ['Laura Gómez', '$ 350.000', 'Cumplido', { v: '05/10/2026', align: 'end' }], ['Carlos Ruiz', '', 'Pendiente', { v: '25/10/2026', align: 'end' }], ['Marta Díaz', '$ 180.000', 'Incumplido', { v: '01/10/2026', align: 'end' }]],
    select: { row: 2, col: 1 }, overlay: callout(470, 330, '¡Borraste el valor por error!', 300),
  }),
  'excel-q-guardar.svg': excel({
    title: 'Gestiones de cobranza.xlsx •', tab: 'Inicio', groups: inicio(), nameBox: 'D6', formula: 'Recordar cuota', cols: COLS_LLAMADAS, rows: LLAMADAS, select: { row: 5, col: 3 },
    overlay: callout(820, 420, 'Terminaste: guarda el libro', 300),
  }),
  'excel-q-moneda.svg': excel({
    tab: 'Inicio', groups: inicio({ currency: true }), nameBox: 'B2', formula: '1250000', cols: COLS_PAGOS,
    rows: [['Cliente', 'Saldo'], ['Laura Gómez', '1250000'], ['Carlos Ruiz', '980000'], ['Marta Díaz', '2310000']], select: { row: 1, col: 1, h: 3, range: true },
    overlay: callout(470, 340, 'Se debe leer $ 1.250.000', 290),
  }),
};

for (const [name, svg] of Object.entries(images)) fs.writeFileSync(path.join(out, name), svg);
console.log(`${Object.keys(images).length} imágenes de Excel en ${out}`);
