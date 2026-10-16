// Genera las ilustraciones SVG de las lecciones de Ofimática (1280x720) en la carpeta indicada.
const fs = require('fs');
const path = require('path');
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });

const W = 1280, H = 720;
const C = { wine: '#8b1538', navy: '#192840', gold: '#d4af37', cream: '#fffaf0', ink: '#24324a', muted: '#6b7588', line: '#e3e7ee', ok: '#1f7a4c', okBg: '#e8f7ef', bad: '#a3243b', badBg: '#fdecef', soft: '#f4f6fa' };
const FONT = "Segoe UI, 'DM Sans', Arial, sans-serif";
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function t(x, y, s, { size = 28, weight = 400, fill = C.ink, anchor = 'start', italic = false, deco = '' } = {}) {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${italic ? ' font-style="italic"' : ''}${deco ? ` text-decoration="${deco}"` : ''}>${esc(s)}</text>`;
}
const rect = (x, y, w, h, fill, { r = 18, stroke = 'none', sw = 0 } = {}) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;

function frame(title, kicker, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fffdf7"/><stop offset="1" stop-color="#f6efe0"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="1210" cy="70" r="150" fill="${C.gold}" opacity=".10"/><circle cx="60" cy="680" r="120" fill="${C.wine}" opacity=".06"/>
  ${t(64, 78, kicker, { size: 20, weight: 700, fill: C.wine })}
  ${t(64, 128, title, { size: 44, weight: 800, fill: C.navy })}
  <rect x="64" y="148" width="90" height="5" rx="2.5" fill="${C.gold}"/>
  ${body}
</svg>
`;
}

// Tarjeta de palabra: palabra grande, qué es y un ejemplo.
function wordCard(x, y, w, h, word, kind, example, color = C.wine) {
  return `${rect(x, y, w, h, '#fff', { stroke: C.line, sw: 2 })}
  <rect x="${x}" y="${y}" width="${w}" height="10" rx="5" fill="${color}"/>
  ${t(x + w / 2, y + 92, word, { size: 58, weight: 800, fill: color, anchor: 'middle' })}
  ${t(x + w / 2, y + 140, kind, { size: 24, weight: 600, fill: C.muted, anchor: 'middle' })}
  <line x1="${x + 30}" y1="${y + 168}" x2="${x + w - 30}" y2="${y + 168}" stroke="${C.line}" stroke-width="2"/>
  ${t(x + w / 2, y + 214, example, { size: 24, fill: C.ink, anchor: 'middle', italic: true })}`;
}

function tip(text, y = 640) {
  return `${rect(64, y - 44, W - 128, 66, C.navy, { r: 16 })}
  <circle cx="104" cy="${y - 11}" r="16" fill="${C.gold}"/>${t(104, y - 3, '!', { size: 24, weight: 800, fill: C.navy, anchor: 'middle' })}
  ${t(136, y - 2, text, { size: 24, weight: 600, fill: '#fff' })}`;
}

function cards(items, y = 200, h = 250) {
  const gap = 28, n = items.length, w = (W - 128 - gap * (n - 1)) / n;
  const colors = [C.wine, C.navy, '#9a6b00', C.ok];
  return items.map((item, i) => wordCard(64 + i * (w + gap), y, w, h, item[0], item[1], item[2], colors[i % colors.length])).join('\n');
}

// Comparación incorrecto → correcto.
function compare(rows, y0 = 200) {
  return rows.map(([bad, good], i) => {
    const y = y0 + i * 118;
    return `${rect(64, y, 540, 92, C.badBg, { r: 16 })}${t(96, y + 58, '✗', { size: 32, weight: 800, fill: C.bad })}${t(140, y + 57, bad, { size: 27, fill: C.bad, deco: 'line-through' })}
    <path d="M622 ${y + 46} h36 m-12 -12 l12 12 l-12 12" stroke="${C.gold}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    ${rect(676, y, 540, 92, C.okBg, { r: 16 })}${t(708, y + 58, '✓', { size: 32, weight: 800, fill: C.ok })}${t(752, y + 57, good, { size: 27, weight: 700, fill: C.ok })}`;
  }).join('\n');
}

// Hoja de cálculo simple.
function sheet(x, y, cols, rows, { highlight = -1, widths, headExtra = () => '' } = {}) {
  const rh = 52; const total = widths.reduce((a, b) => a + b, 0);
  let s = `${rect(x, y, total, rh * (rows.length + 1), '#fff', { r: 12, stroke: C.line, sw: 2 })}`;
  s += `<rect x="${x}" y="${y}" width="${total}" height="${rh}" rx="12" fill="${C.navy}"/><rect x="${x}" y="${y + rh - 12}" width="${total}" height="12" fill="${C.navy}"/>`;
  let cx = x;
  cols.forEach((col, i) => { s += t(cx + 16, y + 34, col, { size: 21, weight: 700, fill: '#fff' }); s += headExtra(i, cx, y, widths[i]); cx += widths[i]; });
  rows.forEach((row, r) => {
    const ry = y + rh * (r + 1);
    if (r === highlight) s += `<rect x="${x + 2}" y="${ry}" width="${total - 4}" height="${rh}" fill="#fff4cc"/><rect x="${x + 2}" y="${ry}" width="6" height="${rh}" fill="${C.gold}"/>`;
    s += `<line x1="${x}" y1="${ry}" x2="${x + total}" y2="${ry}" stroke="${C.line}" stroke-width="1.5"/>`;
    let ccx = x;
    row.forEach((cell, i) => {
      if (cell && typeof cell === 'object') s += `${rect(ccx + 12, ry + 11, cell.w ?? 130, 30, cell.bg, { r: 15 })}${t(ccx + 12 + (cell.w ?? 130) / 2, ry + 33, cell.text, { size: 18, weight: 700, fill: cell.fg, anchor: 'middle' })}`;
      else s += t(ccx + 16, ry + 34, cell, { size: 21, fill: r === highlight ? C.navy : C.ink, weight: r === highlight ? 700 : 400 });
      ccx += widths[i];
    });
  });
  return s;
}

const images = {
  'excel-busquedas.svg': frame('Búsquedas con filtro', 'EXCEL PARA COBRANZAS', `
    ${sheet(64, 200, ['Cédula', 'Nombre', 'Teléfono', 'Empresa'], [
      ['1032456789', 'Laura Gómez', '300 456 7788', 'Banco Andino'],
      ['80123456', 'Carlos Ruiz', '311 220 9911', 'Banco Andino'],
      ['52987654', 'Marta Díaz', '315 774 1020', 'Banco Andino'],
    ], { highlight: 1, widths: [210, 260, 230, 300], headExtra: (i, cx, y, w) => i === 3 ? `${rect(cx + w - 52, y + 11, 36, 30, C.gold, { r: 8 })}<path d="M${cx + w - 43} ${y + 20} h18 l-7 9 v7 l-4 -3 v-4 z" fill="${C.navy}"/>` : '' })}
    ${rect(1088, 200, 128, 208, '#fff', { stroke: C.line, sw: 2, r: 14 })}
    ${t(1152, 244, 'Filtro', { size: 20, weight: 700, fill: C.muted, anchor: 'middle' })}
    ${t(1152, 292, '☑ Banco', { size: 19, weight: 700, fill: C.navy, anchor: 'middle' })}${t(1152, 318, 'Andino', { size: 19, weight: 700, fill: C.navy, anchor: 'middle' })}
    ${t(1152, 362, '☐ Otras', { size: 19, fill: C.muted, anchor: 'middle' })}
    ${tip('Filtra la columna Empresa y salta directo al cliente que buscas.')}`),

  'excel-volver.svg': frame('Volver a llamar', 'EXCEL PARA COBRANZAS', `
    ${sheet(64, 200, ['Cliente', 'Fecha', 'Hora', 'Motivo'], [
      ['Laura Gómez', '16/10/2026', '09:30', 'Confirmar pago'],
      ['Carlos Ruiz', '17/10/2026', '11:00', 'Enviar soporte'],
      ['Marta Díaz', '20/10/2026', '15:45', 'Revisar acuerdo'],
    ], { highlight: 0, widths: [270, 220, 150, 300] })}
    ${rect(1040, 200, 176, 208, C.navy, { r: 16 })}
    <path d="M1128 236 v120 m-22 -22 l22 22 l22 -22" stroke="${C.gold}" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    ${t(1128, 390, 'Ascendente', { size: 19, weight: 700, fill: '#fff', anchor: 'middle' })}
    ${tip('Cliente, fecha y hora. Ordena ascendente: la más próxima queda arriba.')}`),

  'excel-acuerdos.svg': frame('Acuerdos de pago', 'EXCEL PARA COBRANZAS', `
    ${sheet(64, 200, ['Cliente', 'Valor', 'Estado', 'Fecha'], [
      ['Laura Gómez', '$ 350.000', { text: 'Cumplido', bg: C.okBg, fg: C.ok, w: 150 }, '05/10/2026'],
      ['Carlos Ruiz', '$ 520.000', { text: 'Pendiente', bg: '#fff4dc', fg: '#8a6510', w: 150 }, '25/10/2026'],
      ['Marta Díaz', '$ 180.000', { text: 'Incumplido', bg: C.badBg, fg: C.bad, w: 150 }, '01/10/2026'],
    ], { widths: [330, 260, 260, 302] })}
    ${tip('Un acuerdo completo tiene valor, estado y fecha.')}`),

  'excel-pagos.svg': frame('Pagos con fórmulas', 'EXCEL PARA COBRANZAS', `
    ${rect(64, 186, 1152, 58, '#fff', { r: 12, stroke: C.line, sw: 2 })}
    ${t(92, 224, 'fx', { size: 24, weight: 800, fill: C.wine, italic: true })}<line x1="136" y1="198" x2="136" y2="232" stroke="${C.line}" stroke-width="2"/>
    ${t(156, 225, '=H2-I2', { size: 26, weight: 700, fill: C.navy })}
    ${sheet(64, 270, ['Cliente', 'Saldo', 'Meta (H)', 'Recaudo (I)', 'Faltante'], [
      ['Laura Gómez', '$ 1.200.000', '$ 400.000', '$ 250.000', { text: '$ 150.000', bg: '#fff4cc', fg: C.navy, w: 170 }],
      ['Carlos Ruiz', '$ 900.000', '$ 300.000', '$ 300.000', { text: '$ 0', bg: C.okBg, fg: C.ok, w: 170 }],
      ['Total saldos', '=SUMA(C2:C500)', '', '', ''],
    ], { widths: [230, 260, 210, 230, 222] })}
    ${tip('Las fórmulas empiezan con = y el formato de moneda muestra pesos (COP).')}`),

  'orto-a-ver-haber.svg': frame('A ver / haber', 'ORTOGRAFÍA APLICADA', `
    ${cards([['a ver', 'para mirar o pedir', '«Vamos a ver tu pago.»'], ['haber', 'verbo', '«Debe haber pagado.»']])}
    ${tip('Si puedes decir «vamos a mirar», escribe «a ver».')}`),

  'orto-hay-ahi-ay.svg': frame('Hay / ahí / ay', 'ORTOGRAFÍA APLICADA', `
    ${cards([['hay', 'existe (verbo haber)', '«Hay un acuerdo.»'], ['ahí', 'en ese lugar', '«El soporte está ahí.»'], ['ay', 'exclamación', '«¡Ay, se me olvidó!»']])}
    ${tip('«Hay» equivale a «existe»; «ahí» equivale a «en ese lugar».')}`),

  'orto-porque.svg': frame('Porque / por qué / porqué', 'ORTOGRAFÍA APLICADA', `
    ${cards([['porque', 'da la causa', '«No pagó porque…»'], ['por qué', 'pregunta', '«¿Por qué no pagó?»'], ['el porqué', 'el motivo', '«Explicó el porqué.»']])}
    ${tip('Causa: porque · Pregunta: por qué · Motivo: el porqué.')}`),

  'orto-sino-si-no.svg': frame('Sino / si no', 'ORTOGRAFÍA APLICADA', `
    ${cards([['sino', 'contrapone (tras un «no»)', '«No el lunes, sino el martes.»'], ['si no', 'condición', '«Si no paga hoy, se reporta.»']])}
    ${tip('«Si no» equivale a «en caso de que no».')}`),

  'orto-ha-a-hecho-echo.svg': frame('Ha / a y hecho / echo', 'ORTOGRAFÍA APLICADA', `
    ${cards([['ha', 'verbo haber', '«El cliente ha pagado.»'], ['a', 'preposición', '«Llamé a Laura.»'], ['hecho', 'de hacer', '«Ya está hecho.»'], ['echo', 'de echar', '«Echo la carta.»']], 200, 250)}
    ${tip('Si lo puedes cambiar por «había», es «ha».')}`),

  'orto-tildes-diacriticas.svg': frame('Tildes diacríticas', 'ORTOGRAFÍA APLICADA', `
    ${[['tú', 'tu'], ['él', 'el'], ['sí', 'si'], ['mí', 'mi']].map(([a, b], i) => {
      const x = 64 + i * 295;
      return `${rect(x, 200, 267, 250, '#fff', { stroke: C.line, sw: 2 })}
      ${t(x + 72, 300, a, { size: 64, weight: 800, fill: C.wine, anchor: 'middle' })}${t(x + 195, 300, b, { size: 64, weight: 800, fill: C.navy, anchor: 'middle' })}
      ${t(x + 72, 340, 'con tilde', { size: 19, weight: 700, fill: C.wine, anchor: 'middle' })}${t(x + 195, 340, 'sin tilde', { size: 19, weight: 700, fill: C.navy, anchor: 'middle' })}
      <line x1="${x + 133}" y1="245" x2="${x + 133}" y2="350" stroke="${C.line}" stroke-width="2"/>
      ${t(x + 133, 400, ['pronombre / posesivo', 'pronombre / artículo', 'afirmación / condición', 'pronombre / posesivo'][i], { size: 18, fill: C.muted, anchor: 'middle' })}`;
    }).join('\n')}
    ${tip('«El cliente dijo que sí.» · «Tú debes confirmar si llegó.»')}`),

  'orto-errores-orales.svg': frame('Errores frecuentes al hablar', 'ORTOGRAFÍA APLICADA', `
    ${compare([['dijistes', 'dijiste'], ['haiga', 'haya'], ['hubieron muchas personas', 'hubo muchas personas']])}
    ${tip('En la observación escribe la forma correcta, aunque se diga distinto.')}`),
};

for (const [name, svg] of Object.entries(images)) fs.writeFileSync(path.join(out, name), svg);
console.log(Object.keys(images).length + ' imágenes en ' + out);
