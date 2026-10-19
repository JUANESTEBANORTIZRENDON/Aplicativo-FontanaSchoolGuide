// Lectura y escritura mínima de PNG (8 bits, sin entrelazado) con zlib de Node: evita añadir dependencias.
import { deflateSync, inflateSync } from 'node:zlib';
import { readFileSync, writeFileSync } from 'node:fs';

const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buffer) => { let c = 0xffffffff; for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

export function readPng(path) {
  const data = readFileSync(path);
  let offset = 8, width = 0, height = 0, depth = 0, type = 0, interlace = 0;
  const parts = [];
  while (offset < data.length) {
    const length = data.readUInt32BE(offset); const name = data.toString('ascii', offset + 4, offset + 8);
    const body = data.subarray(offset + 8, offset + 8 + length);
    if (name === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); depth = body[8]; type = body[9]; interlace = body[12]; }
    else if (name === 'IDAT') parts.push(body);
    offset += 12 + length;
  }
  if (depth !== 8 || interlace !== 0 || ![2, 6].includes(type)) throw new Error(`PNG no soportado: ${path} (depth ${depth}, tipo ${type}, interlace ${interlace})`);
  const channels = type === 6 ? 4 : 3; const stride = width * channels;
  const raw = inflateSync(Buffer.concat(parts)); const out = Buffer.alloc(width * height * 4, 255);
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]; const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0, b = prev[i], c = i >= channels ? prev[i - channels] : 0;
      const predictor = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? (a + b) >> 1 : (() => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; })();
      line[i] = (line[i] + predictor) & 0xff;
    }
    for (let x = 0; x < width; x++) { const o = (y * width + x) * 4; out[o] = line[x * channels]; out[o + 1] = line[x * channels + 1]; out[o + 2] = line[x * channels + 2]; if (channels === 4) out[o + 3] = line[x * channels + 3]; }
    prev = line;
  }
  return { width, height, data: out };
}

export function writePng(path, { width, height, data }) {
  const stride = width * 4; const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (stride + 1)] = 0; data.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride); }
  const chunk = (name, body) => { const out = Buffer.alloc(12 + body.length); out.writeUInt32BE(body.length, 0); out.write(name, 4, 'ascii'); body.copy(out, 8); out.writeUInt32BE(crc32(out.subarray(4, 8 + body.length)), 8 + body.length); return out; };
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]));
}
