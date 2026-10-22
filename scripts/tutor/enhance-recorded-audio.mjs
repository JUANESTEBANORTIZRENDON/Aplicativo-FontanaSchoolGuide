// Procesa copias de las grabaciones originales sin modificar el tono ni la velocidad.
// node scripts/tutor/enhance-recorded-audio.mjs
// Las grabaciones de entrada y los resultados se conservan en .local/audio-review/.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const run = promisify(execFile);
const config = JSON.parse(readFileSync(path.join(process.env.LOCALAPPDATA, 'fontana-tts/config.json'), 'utf8').replace(/^\uFEFF/, ''));
const recordings = JSON.parse(readFileSync('.local/audio-review/report.json', 'utf8'));
const ids = ['respeto', 'informacion', 'verificar', 'claridad', 'compromiso'];
const destination = '.local/audio-review/claros';
mkdirSync(destination, { recursive: true });
// Limpieza moderada, reducción suave del ambiente en pausas, presencia y compresión ligera.
// La expansión atenúa las colas de ambiente; no pretende eliminar ecos superpuestos al habla.
const filters = [
  'highpass=f=80:p=2',
  'afftdn=nr=9:nf=-45:tn=1:gs=8',
  'agate=threshold=0.008:ratio=1.4:range=0.5:attack=10:release=180:knee=3',
  'equalizer=f=250:t=q:w=0.8:g=-1.2',
  'equalizer=f=2800:t=q:w=0.7:g=1.5',
  'acompressor=threshold=0.125:ratio=1.8:attack=15:release=180:makeup=1:knee=2.5',
].join(',');
const ffmpeg = args => run(config.ffmpeg, ['-hide_banner', ...args], { maxBuffer: 32 * 1024 * 1024 });
async function loudness(file, filter = '') {
  const { stderr } = await ffmpeg(['-i', file, '-af', `${filter ? filter + ',' : ''}loudnorm=I=-16:TP=-2.5:LRA=7:print_format=json`, '-f', 'null', '-']);
  return JSON.parse(stderr.slice(stderr.lastIndexOf('{'), stderr.lastIndexOf('}') + 1));
}
async function decodedMetrics(file) {
  const { stdout } = await run(config.ffmpeg, ['-v', 'error', '-i', file, '-ac', '1', '-ar', '48000', '-f', 'f32le', '-'], { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 });
  let peak = 0, clipped = 0;
  for (let i = 0; i < stdout.length; i += 4) {
    const sample = Math.abs(stdout.readFloatLE(i));
    if (!Number.isFinite(sample)) throw new Error('Muestra de audio no válida.');
    peak = Math.max(peak, sample);
    if (sample >= 1) clipped++;
  }
  return { durationMs: Math.round(stdout.length / 192), peakDb: +(20 * Math.log10(peak)).toFixed(2), clippedSamples: clipped };
}
const report = [];
for (const [index, recording] of recordings.entries()) {
  const original = path.join('.local/audio-review/originales', recording.original);
  const output = path.join(destination, `${ids[index]}.ogg`);
  const measured = await loudness(original, filters);
  const normalization = `loudnorm=I=-16:TP=-2.5:LRA=7:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=false`;
  await ffmpeg(['-y', '-loglevel', 'error', '-i', original, '-af', `${filters},${normalization}`, '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '80k', output]);
  const before = await loudness(original), after = await loudness(output);
  const metrics = await decodedMetrics(output);
  const sourceMetrics = await decodedMetrics(original);
  if (metrics.clippedSamples || +after.input_tp > -1 || Math.abs(metrics.durationMs - sourceMetrics.durationMs) > 30 || Math.abs(+after.input_i + 16) > 1) {
    throw new Error(`El audio ${ids[index]} no cumple los límites de volumen, duración o saturación.`);
  }
  const entry = { id: ids[index], original: recording.original, output, originalLUFS: +before.input_i, processedLUFS: +after.input_i, truePeakDb: +after.input_tp, ...metrics };
  report.push(entry);
  console.log(JSON.stringify(entry));
}
writeFileSync(path.join(destination, 'report.json'), JSON.stringify({ filters, targetLUFS: -16, report }, null, 2));
