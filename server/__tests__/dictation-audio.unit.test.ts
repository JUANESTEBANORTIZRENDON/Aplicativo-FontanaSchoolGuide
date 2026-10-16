import { describe, expect, it } from 'vitest';
import {
  audioFileName, DICTATION_AUDIO, nextLengthScale, parseFfmpegAnalysis, storedDuration, validateAudio, wordsToCheck,
} from '../domain/dictation-audio.js';

const ok = { durationSeconds: 26, sizeBytes: 160_000, longestSilenceSeconds: 0.7, peakDb: -1.6, meanDb: -19 };

describe('audios del dictado', () => {
  it('arma el nombre dictado-<key>-v<version>.ogg sin repetir el prefijo', () => {
    expect(audioFileName('dictado-error-saldo', 1)).toBe('dictado-error-saldo-v1.ogg');
    expect(audioFileName('seguimiento', 2)).toBe('dictado-seguimiento-v2.ogg');
    expect(() => audioFileName('con espacio', 1)).toThrow();
  });

  it('valida duración, tamaño, silencios y volumen', () => {
    expect(validateAudio(ok)).toEqual([]);
    expect(validateAudio({ ...ok, durationSeconds: 18.4 })[0]).toMatch(/entre 20 y 30/);
    expect(validateAudio({ ...ok, durationSeconds: 31 })).toHaveLength(1);
    expect(validateAudio({ ...ok, sizeBytes: DICTATION_AUDIO.maxBytes + 1 })[0]).toMatch(/máximo/);
    expect(validateAudio({ ...ok, sizeBytes: 0 })[0]).toMatch(/vacío/);
    expect(validateAudio({ ...ok, longestSilenceSeconds: 2.6 })[0]).toMatch(/silencio/);
    expect(validateAudio({ ...ok, peakDb: 0 })[0]).toMatch(/saturación/);
    expect(validateAudio({ ...ok, meanDb: -40 })[0]).toMatch(/bajo/);
  });

  it('guarda la duración en segundos enteros dentro del rango del validador', () => {
    expect(storedDuration(25.6)).toBe(26);
    expect(storedDuration(19.7)).toBe(20);
    expect(storedDuration(30.4)).toBe(30);
  });

  it('ajusta la velocidad con un motor simulado hasta quedar entre 24 y 28 s', () => {
    // Motor simulado: la duración crece en proporción a la escala de los fonemas.
    const fakeEngine = (scale: number) => 20 * scale;
    let scale: number = DICTATION_AUDIO.lengthScale.start;
    for (let i = 0; i < DICTATION_AUDIO.maxRetries; i++) {
      const next = nextLengthScale(scale, fakeEngine(scale));
      if (next === null) break;
      scale = next;
    }
    expect(fakeEngine(scale)).toBeGreaterThanOrEqual(DICTATION_AUDIO.targetMin);
    expect(fakeEngine(scale)).toBeLessThanOrEqual(DICTATION_AUDIO.targetMax);
    // Si ni con la escala máxima alcanza, no propone nada (se avisa en vez de recortar el texto).
    expect(nextLengthScale(DICTATION_AUDIO.lengthScale.max, 12)).toBeNull();
  });

  it('lee silencios y volumen de la salida de ffmpeg y lista las palabras a revisar', () => {
    const stderr = '[silencedetect] silence_end: 3.1 | silence_duration: 0.62\n[silencedetect] silence_duration: 1.4\n[Parsed_volumedetect_1] mean_volume: -19.8 dB\n[Parsed_volumedetect_1] max_volume: -1.5 dB';
    expect(parseFfmpegAnalysis(stderr)).toEqual({ longestSilenceSeconds: 1.4, peakDb: -1.5, meanDb: -19.8 });
    expect(wordsToCheck('A ver si hoy llega. Es posible que haya un error. ¿Por qué no contestó?')).toEqual(expect.arrayContaining(['a ver', 'haya', 'por qué']));
  });
});
