// Genera la voz de cada principio con la voz local del proyecto (Piper es_MX-claude-high, ver server/scripts/tts)
// y calcula una «línea de boca»: un bit cada 25 ms (1 = hay voz) a partir del volumen real del audio, para que el
// tutor abra y cierre la boca exactamente cuando suena la voz.
//   node scripts/tutor/generate-principle-audio.mjs [--only <id>]
// Salida: public/tutor/audio/<id>.ogg (OGG Opus mono 48 kHz) y src/tutor/principle-audio.generated.ts
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const STEP_MS = 25;
const mouthOnly = process.argv.includes('--mouth-only'); // recalcula la boca con los .ogg existentes
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
const configPath = path.join(process.env.LOCALAPPDATA ?? os.homedir(), 'fontana-tts', 'config.json');
if (!existsSync(configPath)) throw new Error(`Falta ${configPath}: ejecuta server/scripts/tts/setup-tts.ps1.`);
const config = JSON.parse(readFileSync(configPath, 'utf8').replace(/^﻿/, ''));
if (config.engine !== 'piper') throw new Error('Este script usa Piper (motor configurado: ' + config.engine + ').');
const content = JSON.parse(readFileSync('src/tutor/principles.json', 'utf8'));
mkdirSync('public/tutor/audio', { recursive: true });
const work = path.join(os.tmpdir(), 'fontana-tutor-voz'); mkdirSync(work, { recursive: true });

async function synthesize(text, wav) {
  const textFile = `${wav}.txt`; writeFileSync(textFile, text, 'utf8'); // el texto va por archivo, nunca en la línea de comandos
  try { await run(config.python, ['-m', 'piper', '-m', config.modelPath, '-i', textFile, '-f', wav, '--length-scale', '1.08', '--sentence-silence', '0.45'], { maxBuffer: 32 * 1024 * 1024 }); }
  finally { rmSync(textFile, { force: true }); }
}
const toOgg = (wav, ogg) => run(config.ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-i', wav, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '48k', ogg]);
async function durationMs(ogg) { const { stdout } = await run(config.ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', ogg]); return Math.round(Number(stdout.trim()) * 1000); }

// Línea de boca desde el audio decodificado (16 kHz, 16 bits). La energía se mide cada 25 ms y la boca se abre cuando
// la energía supera su media local (±150 ms): así sigue el ritmo de las sílabas en vez de quedarse abierta todo el habla.
async function mouthLine(ogg) {
  const { stdout } = await run(config.ffmpeg, ['-v', 'error', '-i', ogg, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], { encoding: 'buffer', maxBuffer: 64 * 1024 * 1024 });
  const samples = new Int16Array(stdout.buffer, stdout.byteOffset, Math.floor(stdout.length / 2)); const window = 16 * STEP_MS; const raw = [];
  for (let i = 0; i + window <= samples.length; i += window) { let sum = 0; for (let k = 0; k < window; k++) sum += samples[i + k] * samples[i + k]; raw.push(Math.sqrt(sum / window)); }
  const energies = raw.map((_, i) => (raw[Math.max(0, i - 1)] + raw[i] + raw[Math.min(raw.length - 1, i + 1)]) / 3);
  const sorted = [...energies].sort((a, b) => a - b); const p95 = sorted[Math.floor(sorted.length * 0.95)] || 1; const half = Math.round(150 / STEP_MS);
  const bits = energies.map((e, i) => { let sum = 0, n = 0; for (let k = Math.max(0, i - half); k <= Math.min(energies.length - 1, i + half); k++) { sum += energies[k]; n++; } return e > p95 * 0.12 && e >= (sum / n) * 0.92 ? 1 : 0; });
  // dentro del habla no hay cierres de una sola ventana; las aperturas deben durar al menos 3 ventanas (75 ms)
  const minOpen = 3;
  for (let i = 1; i < bits.length - 1; i++) if (!bits[i] && bits[i - 1] && bits[i + 1]) bits[i] = 1;
  let i = 0; while (i < bits.length) { if (!bits[i]) { i++; continue; } let j = i; while (j < bits.length && bits[j]) j++; if (j - i < minOpen) for (let k = i; k < j; k++) bits[k] = 0; i = j; }
  return bits.join('');
}

const entries = {};
for (const item of content.items) {
  if (only && item.id !== only) continue;
  const wav = path.join(work, `${item.id}.wav`), ogg = `public/tutor/audio/${item.id}.ogg`;
  if (!mouthOnly) { await synthesize(item.narration, wav); await toOgg(wav, ogg); rmSync(wav, { force: true }); }
  const ms = await durationMs(ogg), mouth = await mouthLine(ogg);
  entries[item.id] = { src: `/tutor/audio/${item.id}.ogg`, durationMs: ms, mouth, textHash: createHash('sha1').update(item.narration).digest('hex').slice(0, 12) };
  console.log(`${item.id}: ${(ms / 1000).toFixed(1)} s · ${(statSync(ogg).size / 1024).toFixed(0)} KB · boca abierta ${(mouth.split('').filter((b) => b === '1').length / mouth.length * 100).toFixed(0)} %`);
}
// con --only se conservan las demás entradas ya generadas
let previous = {};
if ((only || mouthOnly) && existsSync('src/tutor/principle-audio.generated.ts')) { const m = /export const PRINCIPLE_AUDIO = (\{[\s\S]*?\}) as const;/.exec(readFileSync('src/tutor/principle-audio.generated.ts', 'utf8')); if (m) previous = JSON.parse(m[1]); }
writeFileSync('src/tutor/principle-audio.generated.ts', `// Generado por scripts/tutor/generate-principle-audio.mjs: no editar a mano.\n// Voz: Piper ${config.voice} (licencia ${config.license}). «mouth»: un bit cada ${STEP_MS} ms (1 = suena la voz).\nexport const PRINCIPLE_AUDIO_STEP_MS = ${STEP_MS};\nexport const PRINCIPLE_AUDIO = ${JSON.stringify({ ...previous, ...entries }, null, 1)} as const;\n`);
