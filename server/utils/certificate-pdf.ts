// Certificado en PDF sin dependencias: una página A4 horizontal con las fuentes estándar Helvetica
// (incluidas en todo lector de PDF) y codificación WinAnsi, que cubre las tildes y la ñ del español.

export type CertificatePdfData = {
  holder: string;
  trainingName: string;
  issuedAt: Date;
  code: string;
  verifyUrl: string;
  timeZone: string;
};

const WIDTH = 842;
const HEIGHT = 595;
// Colores de la identidad de Fontana School (src/styles.css): vino, dorado y tinta.
const RED = [0.545, 0.082, 0.22] as const;
const GOLD = [0.831, 0.686, 0.216] as const;
const INK = [0.067, 0.094, 0.153] as const;
const MUTED = [0.384, 0.4, 0.447] as const;

// Anchos de Helvetica y Helvetica-Bold (métrica AFM, en milésimas de em) para centrar el texto.
const HELVETICA: Record<string, number> = {};
const HELVETICA_BOLD: Record<string, number> = {};
function widths(target: Record<string, number>, table: string): void {
  for (const pair of table.trim().split(/\s+/)) {
    const [chars, value] = pair.split('=');
    for (const char of chars!) target[char] = Number(value);
  }
}
widths(HELVETICA, `
 ¡!.,:;'|=278 "=355 #$0123456789_?¿=556 %=889 &=667 ()-`+"`"+`=333 *=389 +<>~=584 /=278 @=1015
 ABEKPSVXY=667 ÁÉ=667 CDHNRUÑÚÜ=722 FTZ=611 GOQÓ=778 IÍ=278 J=500 L=556 M=833 W=944 [\\]=278 ^=469
 abdeghnopqáéñóúuüá=556 cksvxyz=500 fijlríí=278 m=833 t=278 w=722 {}=334 «»=556 ·=278
`);
widths(HELVETICA_BOLD, `
 ¡!:;=333 .,'=278 "=474 #$0123456789_=556 ?¿=611 %=889 &=722 ()-=333 *=389 +<>=584 /=278 @=975
 ABCDHKNRUÑÚÜÁ=722 EPSVXYÉ=667 FTZ=611 GOQÓ=778 IÍ=278 J=556 L=611 M=833 W=944
 aceásé=556 bdghnopquñóúü=611 fítr=333 ijlí=278 kvxy=556 m=889 w=778 z=500 «»=556 ·=278
`);

function textWidth(text: string, size: number, bold: boolean): number {
  const table = bold ? HELVETICA_BOLD : HELVETICA;
  return [...text].reduce((sum, char) => sum + (table[char] ?? (char === ' ' ? 278 : 556)), 0) * size / 1000;
}

// Texto literal de PDF en WinAnsi: se escapan paréntesis y barras; los caracteres fuera de Latin-1 se omiten.
function literal(text: string): string {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (char === '(' || char === ')' || char === '\\') out += `\\${char}`;
    else if (code >= 32 && code <= 126) out += char;
    else if (code >= 160 && code <= 255) out += `\\${code.toString(8).padStart(3, '0')}`;
    else if (char === '–' || char === '—') out += '-';
  }
  return out;
}

const color = (rgb: readonly number[], stroke = false) => `${rgb.map((value) => value.toFixed(3)).join(' ')} ${stroke ? 'RG' : 'rg'}`;

function centered(text: string, y: number, size: number, options: { bold?: boolean; rgb?: readonly number[] } = {}): string {
  const font = options.bold ? 'F2' : 'F1';
  const x = (WIDTH - textWidth(text, size, Boolean(options.bold))) / 2;
  return `BT /${font} ${size} Tf ${color(options.rgb ?? INK)} ${x.toFixed(2)} ${y} Td (${literal(text)}) Tj ET`;
}

// Ajusta el tamaño para que un nombre largo quepa en el ancho disponible.
function fitSize(text: string, max: number, maxWidth: number, bold: boolean): number {
  let size = max;
  while (size > 14 && textWidth(text, size, bold) > maxWidth) size -= 1;
  return size;
}

export function certificatePdf(data: CertificatePdfData): Buffer {
  const date = new Intl.DateTimeFormat('es-CO', { timeZone: data.timeZone, day: 'numeric', month: 'long', year: 'numeric' }).format(data.issuedAt);
  const nameSize = fitSize(data.holder, 34, WIDTH - 200, true);
  const content = [
    // Fondo marfil y doble marco vino/dorado.
    `${color([0.992, 0.98, 0.957])} 0 0 ${WIDTH} ${HEIGHT} re f`,
    `${color(RED, true)} 6 w 24 24 ${WIDTH - 48} ${HEIGHT - 48} re S`,
    `${color(GOLD, true)} 1.5 w 38 38 ${WIDTH - 76} ${HEIGHT - 76} re S`,
    // Sello: dos círculos dorados con las iniciales.
    ...circle(WIDTH / 2, 478, 34, GOLD, 2.5),
    ...circle(WIDTH / 2, 478, 27, RED, 1),
    centered('FS', 470, 22, { bold: true, rgb: RED }),
    centered('FONTANA SCHOOL', 418, 13, { bold: true, rgb: RED }),
    centered('CERTIFICADO DE FORMACIÓN', 384, 26, { bold: true }),
    `${color(GOLD, true)} 1 w ${WIDTH / 2 - 120} 370 m ${WIDTH / 2 + 120} 370 l S`,
    centered('Se certifica que', 336, 13, { rgb: MUTED }),
    centered(data.holder, 296, nameSize, { bold: true, rgb: RED }),
    centered('completó satisfactoriamente la', 258, 13, { rgb: MUTED }),
    centered(data.trainingName, 232, 17, { bold: true }),
    centered(`Bogotá, ${date}`, 198, 12, { rgb: MUTED }),
    // Espacio reservado para la firma institucional (se configurará cuando exista).
    `${color(MUTED, true)} 0.8 w ${WIDTH / 2 - 130} 128 m ${WIDTH / 2 + 130} 128 l S`,
    centered('Firma institucional', 112, 10, { rgb: MUTED }),
    centered(`Código de verificación: ${data.code}`, 72, 11, { bold: true }),
    centered(`Verifica este certificado en ${data.verifyUrl}`, 56, 9, { rgb: MUTED }),
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${WIDTH} ${HEIGHT}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    `<< /Title (${literal(`Certificado ${data.code}`)}) /Author (Fontana School) /Producer (Fontana School) >>`,
  ];
  let body = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, 'latin1'));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

// Círculo con cuatro curvas de Bézier.
function circle(cx: number, cy: number, r: number, rgb: readonly number[], width: number): string[] {
  const k = r * 0.5523;
  return [
    `${color(rgb, true)} ${width} w`,
    `${cx + r} ${cy} m ${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} c ${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} c`,
    `${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r} c ${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy} c S`,
  ];
}

// Documento de refuerzo, deliberadamente diferente del diploma. Paginación y ajuste por métrica real
// para nombres largos, notas y recomendaciones; comparte fuentes WinAnsi y construcción PDF existente.
export function retryReportPdf(lines: string[]): Buffer {
  const wrapped: string[] = [];
  for (const paragraph of lines) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      if (line && textWidth(`${line} ${word}`, 11, false) > 475) { wrapped.push(line); line = ''; }
      // También divide identificadores o palabras muy largas.
      for (const char of word) {
        if (textWidth(line + char, 11, false) > 475) { wrapped.push(line); line = ''; }
        line += char;
      }
      line += ' ';
    }
    wrapped.push(line.trimEnd());
  }
  const pages: string[][] = [];
  for (let i = 0; i < wrapped.length; i += 33) pages.push(wrapped.slice(i, i + 33));
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>', '',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ];
  const pageIds: number[] = [];
  pages.forEach((rows, index) => {
    const pageId = objects.length + 1;
    pageIds.push(pageId);
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageId + 1} 0 R >>`);
    const text = (value: string, x: number, y: number, size = 11, bold = false, rgb: readonly number[] = INK) =>
      `BT /${bold ? 'F2' : 'F1'} ${size} Tf ${color(rgb)} ${x} ${y} Td (${literal(value)}) Tj ET`;
    const content = [
      `${color([0.996, 0.988, 0.969])} 0 0 595 842 re f`,
      `${color(RED)} 0 832 595 10 re f`,
      text('FONTANA SCHOOL', 60, 786, 13, true, RED),
      text('CONSTANCIA DE EVALUACIÓN', 60, 749, 20, true),
      text('Requiere refuerzo - Solicitud de reintento', 60, 724, 12, true, RED),
      `${color(GOLD, true)} 1 w 60 706 m 535 706 l S`,
      ...rows.map((line, i) => text(line, 60, 680 - i * 17)),
      text('Este documento no acredita aprobación ni certificación de la formación.', 60, 66, 10, true, RED),
      text(`Página ${index + 1} de ${pages.length}`, 60, 43, 9, false, MUTED),
    ].join('\n');
    objects.push(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`);
  });
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  let body = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets: number[] = [];
  objects.forEach((object, i) => { offsets.push(Buffer.byteLength(body, 'latin1')); body += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const start = Buffer.byteLength(body, 'latin1');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}
