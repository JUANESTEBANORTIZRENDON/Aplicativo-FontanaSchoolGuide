// Genera con voz sintética local un audio por ejercicio de dictado (el expectedText exacto), lo valida y,
// con --apply, lo carga al almacenamiento privado y lo asocia al ejercicio con los servicios existentes.
//
//   npm run dictation:audio -- --admin-documento <doc>                 (dry-run: solo genera y valida)
//   npm run dictation:audio -- --admin-documento <doc> --apply --no-activate
//
// Opciones: --apply, --dry-run (por defecto), --only <key>, --no-activate, --force-audio,
//           --engine piper|sapi, --voice <nombre>, --model-path <onnx>, --ffmpeg-path <exe>.
// El motor, la voz y ffmpeg se leen de %LOCALAPPDATA%\fontana-tts\config.json (lo crea tts/setup-tts.ps1).
import { execFile } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  audioFileName, DICTATION_AUDIO, nextLengthScale, parseFfmpegAnalysis, storedDuration, validateAudio, wordsToCheck, type AudioMeasures,
} from '../domain/dictation-audio.js';

const run = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));

type Options = {
  apply: boolean; only: string | null; activate: boolean; forceAudio: boolean; adminDocumento: string | null;
  engine: 'piper' | 'sapi'; voice: string; modelPath: string | null; ffmpeg: string; ffprobe: string | null; python: string | null; license: string;
};

function parseArgs(argv: string[]): Options {
  const value = (flag: string) => { const index = argv.indexOf(flag); return index >= 0 ? argv[index + 1] ?? null : null; };
  const configPath = path.join(process.env.LOCALAPPDATA ?? os.homedir(), 'fontana-tts', 'config.json');
  const config = existsSync(configPath) ? JSON.parse(stripBom(readFileSync(configPath, 'utf8'))) as Record<string, string | null> : {};
  const engine = (value('--engine') ?? config.engine ?? 'sapi') as Options['engine'];
  const ffmpeg = value('--ffmpeg-path') ?? config.ffmpeg ?? 'ffmpeg';
  const sibling = path.join(path.dirname(ffmpeg), 'ffprobe.exe');
  return {
    apply: argv.includes('--apply'),
    only: value('--only'),
    activate: !argv.includes('--no-activate'),
    forceAudio: argv.includes('--force-audio'),
    adminDocumento: value('--admin-documento'),
    engine,
    voice: value('--voice') ?? config.voice ?? '',
    modelPath: value('--model-path') ?? config.modelPath ?? null,
    ffmpeg,
    ffprobe: config.ffprobe ?? (existsSync(sibling) ? sibling : null),
    python: config.python ?? null,
    license: config.license ?? 'sin registrar',
  };
}

const stripBom = (text: string) => text.replace(/^\uFEFF/, '');

// ---- Síntesis -----------------------------------------------------------------------------------------
async function synthesize(options: Options, text: string, wavPath: string, lengthScale: number, sapiRate: number): Promise<void> {
  const textFile = `${wavPath}.txt`;
  // El texto siempre va por archivo, nunca interpolado en la línea de comandos.
  await writeFile(textFile, text, 'utf8');
  try {
    if (options.engine === 'piper') {
      if (!options.python || !options.modelPath) throw new Error('Falta python o el modelo de Piper: ejecuta server/scripts/tts/setup-tts.ps1.');
      await run(options.python, ['-m', 'piper', '-m', options.modelPath, '-i', textFile, '-f', wavPath,
        '--length-scale', String(lengthScale), '--sentence-silence', String(DICTATION_AUDIO.sentenceSilence)], { maxBuffer: 16 * 1024 * 1024 });
    } else {
      await run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(here, 'tts', 'sapi-speak.ps1'),
        '-TextFile', textFile, '-OutFile', wavPath, '-Voice', options.voice, '-Rate', String(sapiRate)]);
    }
  } finally {
    await rm(textFile, { force: true });
  }
}

async function toOgg(options: Options, wavPath: string, oggPath: string): Promise<void> {
  await run(options.ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-i', wavPath, '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11',
    '-ac', '1', '-ar', '48000', '-c:a', 'libopus', '-b:a', '48k', oggPath]);
}

async function measure(options: Options, oggPath: string): Promise<AudioMeasures> {
  const sizeBytes = (await stat(oggPath)).size;
  let durationSeconds = 0;
  if (options.ffprobe) {
    const { stdout } = await run(options.ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', oggPath]);
    durationSeconds = Number(stdout.trim());
  }
  // silencedetect (silencios > 2 s por debajo de -45 dB) y volumedetect (pico y volumen medio) en una pasada.
  const analysis = await run(options.ffmpeg, ['-hide_banner', '-nostats', '-i', oggPath, '-af', 'silencedetect=noise=-45dB:d=0.3,volumedetect', '-f', 'null', '-'])
    .then((result) => result.stderr)
    .catch((error: { stderr?: string }) => error.stderr ?? '');
  if (!durationSeconds) {
    const match = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(analysis);
    if (match) durationSeconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  }
  return { durationSeconds, sizeBytes, ...parseFfmpegAnalysis(analysis) };
}

type Generated = { file: string; path: string; measures: AudioMeasures; lengthScale: number; problems: string[] };

// Genera y ajusta la velocidad hasta quedar entre 24 y 28 s (o al menos dentro de 20 a 30), con hasta 3 reintentos.
async function generate(options: Options, workDir: string, key: string, version: number, text: string): Promise<Generated> {
  const file = audioFileName(key, version);
  const oggPath = path.join(workDir, file);
  const wavPath = oggPath.replace(/\.ogg$/, '.wav');
  let lengthScale: number = DICTATION_AUDIO.lengthScale.start;
  let sapiRate = -2;
  let result: Generated | null = null;
  for (let tryNumber = 0; tryNumber <= DICTATION_AUDIO.maxRetries; tryNumber++) {
    await synthesize(options, text, wavPath, lengthScale, sapiRate);
    await toOgg(options, wavPath, oggPath);
    const measures = await measure(options, oggPath);
    result = { file, path: oggPath, measures, lengthScale, problems: validateAudio(measures) };
    const next = options.engine === 'piper' ? nextLengthScale(lengthScale, measures.durationSeconds) : null;
    if (options.engine === 'sapi' && (measures.durationSeconds < DICTATION_AUDIO.targetMin || measures.durationSeconds > DICTATION_AUDIO.targetMax)) {
      const adjusted = Math.max(-3, Math.min(0, sapiRate + (measures.durationSeconds < DICTATION_AUDIO.targetMin ? -1 : 1)));
      if (adjusted !== sapiRate) { sapiRate = adjusted; continue; }
    }
    if (next === null) break;
    lengthScale = next;
  }
  await rm(wavPath, { force: true });
  return result!;
}

// ---- Programa -----------------------------------------------------------------------------------------
async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const { prisma, disconnect } = await import('../config/prisma.js');
  const { getStorage } = await import('../integrations/storage.js');
  const { uploadMedia } = await import('../services/media.service.js');
  const { updateDictation } = await import('../services/office-admin.service.js');
  const { esAdministrador } = await import('../domain/enums.js');

  try {
    // Con --apply se exige un administrador real: queda como autor en la auditoría.
    let context: { actorUserId: string; requestId: string; ip: string } | null = null;
    if (options.apply) {
      if (!options.adminDocumento) throw new Error('Con --apply indica --admin-documento <documento de un administrador>.');
      const admin = await prisma.usuario.findUnique({ where: { numeroDocumento: options.adminDocumento }, select: { id: true, rol: true, estado: true } });
      if (!admin || !esAdministrador(admin.rol) || admin.estado !== 'activo') throw new Error('El documento indicado no corresponde a un administrador activo.');
      context = { actorUserId: admin.id, requestId: 'dictation-audio-script', ip: '127.0.0.1' };
    }

    // Última versión vigente por clave (las archivadas no se tocan).
    const rows = await prisma.dictationExercise.findMany({ where: { status: { not: 'ARCHIVED' } }, orderBy: [{ key: 'asc' }, { version: 'desc' }] });
    const latest = [...new Map(rows.map((row) => [row.key, row])).values()].filter((row) => !options.only || row.key === options.only);
    if (!latest.length) throw new Error(options.only ? `No existe el ejercicio ${options.only}.` : 'No hay ejercicios de dictado.');

    const workDir = path.join(os.tmpdir(), 'fontana-dictado');
    await mkdir(workDir, { recursive: true });
    const voiceLabel = `${options.engine === 'piper' ? 'Piper' : 'Windows SAPI'} · ${options.voice}`;
    console.log(`Motor: ${voiceLabel} (licencia: ${options.license})`);
    console.log(`Modo: ${options.apply ? `APLICAR${options.activate ? ' y activar' : ' sin activar'}` : 'dry-run (no escribe en el almacenamiento ni en la base)'}`);
    console.log(`Carpeta de trabajo: ${workDir}\n`);

    const table: Record<string, string | number>[] = [];
    let failures = 0;
    for (const exercise of latest) {
      const file = audioFileName(exercise.key, exercise.version);
      if (exercise.audioKey && await getStorage().exists(exercise.audioKey) && !options.forceAudio) {
        table.push({ key: exercise.key, version: exercise.version, archivo: exercise.audioKey, duracion: exercise.audioDurationSeconds ?? '—', tamano: '—', estado: 'omitido (ya tiene audio)' });
        continue;
      }
      const generated = await generate(options, workDir, exercise.key, exercise.version, exercise.expectedText);
      const m = generated.measures;
      const row: Record<string, string | number> = {
        key: exercise.key, version: exercise.version, archivo: file, duracion: `${m.durationSeconds.toFixed(1)} s`, tamano: `${Math.round(m.sizeBytes / 1024)} KB`,
        escala: generated.lengthScale, silencio_max: `${m.longestSilenceSeconds.toFixed(1)} s`, pico: `${m.peakDb ?? '—'} dB`, estado: '',
      };
      if (generated.problems.length) {
        failures += 1;
        row.estado = `NO VÁLIDO: ${generated.problems.join(' ')}`;
        table.push(row);
        continue;
      }
      if (!options.apply) {
        row.estado = 'válido (dry-run)';
      } else {
        const body = await readFile(generated.path);
        const reason = `Audio sintético local generado con ${voiceLabel}, autorizado por el equipo`;
        await uploadMedia(file, body, context!, reason);
        await updateDictation(exercise.id, {
          audioKey: file, audioDurationSeconds: storedDuration(m.durationSeconds), reason,
          ...(options.activate ? { status: 'ACTIVE' as const } : {}),
        }, context!);
        row.estado = options.activate ? 'cargado y ACTIVO' : `cargado (sigue ${exercise.status})`;
      }
      row.revisar = wordsToCheck(exercise.expectedText).join(', ');
      table.push(row);
    }
    console.table(table);
    if (failures) {
      process.exitCode = 1;
      console.error(`\n${failures} audio(s) no pasaron las validaciones. No se cargó nada de esos ejercicios.`);
    }
  } finally {
    await disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
