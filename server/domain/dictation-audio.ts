// Reglas de los audios del dictado (sin acceso a datos ni a programas externos, para poder probarlas).

export const DICTATION_AUDIO = {
  minSeconds: 20,
  maxSeconds: 30,
  // Duración buscada: deja margen dentro del rango que acepta el validador (20 a 30 s).
  targetMin: 24,
  targetMax: 28,
  maxBytes: 2 * 1024 * 1024,
  // Un silencio más largo que esto indica un corte o un error de síntesis.
  maxSilenceSeconds: 2,
  // Pico máximo permitido: por encima hay riesgo de saturación.
  maxPeakDb: -0.5,
  // Volumen medio mínimo: por debajo el audio se oiría demasiado bajo.
  minMeanDb: -35,
  // Ritmo de dictado (Piper): escala de duración de los fonemas y pausa entre oraciones.
  lengthScale: { min: 1.0, max: 1.3, start: 1.1 },
  sentenceSilence: 0.6,
  maxRetries: 3,
} as const;

const MEDIA_KEY = /^[A-Za-z0-9._-]{1,120}$/;

// dictado-<key>-v<version>.ogg. La clave del ejercicio ya suele empezar por «dictado-»: no se repite.
export function audioFileName(key: string, version: number): string {
  const base = key.startsWith('dictado-') ? key : `dictado-${key}`;
  const name = `${base}-v${version}.ogg`;
  if (!MEDIA_KEY.test(name)) throw new Error(`El nombre de archivo «${name}» no cumple el formato permitido.`);
  return name;
}

export type AudioMeasures = { durationSeconds: number; sizeBytes: number; longestSilenceSeconds: number; peakDb: number | null; meanDb: number | null };

// Validaciones automáticas: nadie escucha el audio antes de cargarlo, así que todo se mide.
export function validateAudio(measures: AudioMeasures): string[] {
  const problems: string[] = [];
  const a = DICTATION_AUDIO;
  if (measures.sizeBytes <= 0) problems.push('El archivo está vacío.');
  if (measures.sizeBytes > a.maxBytes) problems.push(`Pesa ${measures.sizeBytes} bytes; el máximo es ${a.maxBytes}.`);
  if (measures.durationSeconds < a.minSeconds || measures.durationSeconds > a.maxSeconds) {
    problems.push(`Dura ${measures.durationSeconds.toFixed(1)} s; debe durar entre ${a.minSeconds} y ${a.maxSeconds} s.`);
  }
  if (measures.longestSilenceSeconds > a.maxSilenceSeconds) problems.push(`Tiene un silencio de ${measures.longestSilenceSeconds.toFixed(1)} s (máximo ${a.maxSilenceSeconds} s).`);
  if (measures.peakDb !== null && measures.peakDb > a.maxPeakDb) problems.push(`El pico llega a ${measures.peakDb} dB: hay riesgo de saturación.`);
  if (measures.meanDb !== null && measures.meanDb < a.minMeanDb) problems.push(`El volumen medio es ${measures.meanDb} dB: demasiado bajo.`);
  return problems;
}

// Duración que se guarda en el ejercicio: segundos enteros dentro del rango del validador.
export function storedDuration(durationSeconds: number): number {
  return Math.min(DICTATION_AUDIO.maxSeconds, Math.max(DICTATION_AUDIO.minSeconds, Math.round(durationSeconds)));
}

// Siguiente escala de duración para acercarse al centro del rango buscado. null = ya está dentro o no se puede
// corregir sin salir del ritmo natural (en ese caso hay que avisar en lugar de recortar el texto).
export function nextLengthScale(current: number, durationSeconds: number): number | null {
  const a = DICTATION_AUDIO;
  if (durationSeconds >= a.targetMin && durationSeconds <= a.targetMax) return null;
  const target = (a.targetMin + a.targetMax) / 2;
  const proposed = Math.round(current * (target / durationSeconds) * 100) / 100;
  const clamped = Math.min(a.lengthScale.max, Math.max(a.lengthScale.min, proposed));
  return clamped === current ? null : clamped;
}

// Lee la salida de ffmpeg (silencedetect y volumedetect).
export function parseFfmpegAnalysis(stderr: string): { longestSilenceSeconds: number; peakDb: number | null; meanDb: number | null } {
  const silences = [...stderr.matchAll(/silence_duration:\s*([\d.]+)/g)].map((match) => Number(match[1]));
  const peak = /max_volume:\s*(-?[\d.]+) dB/.exec(stderr);
  const mean = /mean_volume:\s*(-?[\d.]+) dB/.exec(stderr);
  return { longestSilenceSeconds: silences.length ? Math.max(...silences) : 0, peakDb: peak ? Number(peak[1]) : null, meanDb: mean ? Number(mean[1]) : null };
}

// Palabras que el dictado evalúa (homófonas y tildes): se listan en el informe para escucharlas con atención.
const WATCH_WORDS = ['haber', 'a ver', 'hay', 'ahí', 'ay', 'sino', 'si no', 'porque', 'por qué', 'haya', 'hubo', 'hecho', 'echo', 'ha', 'tú', 'él', 'sí', 'mí', 'dijiste', 'está'];
export function wordsToCheck(text: string): string[] {
  const lower = text.toLowerCase();
  return WATCH_WORDS.filter((word) => new RegExp(`(^|[^\\p{L}])${word}([^\\p{L}]|$)`, 'u').test(lower));
}
