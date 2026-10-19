/// <reference types="node" />
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BLINK, FRAME_GEOMETRY, FRAME_IDS, IDLE_FRAME, TALK_FRAMES, baseAt, framesOf, talkFrame, type TalkSegment } from './manifest';
import { PRINCIPLES, CHOREOGRAPHY } from './principles';
import { readPng } from '../../scripts/tutor/png.mjs';

const frames = 'public/tutor/frames';

describe('cuadros del tutor', () => {
  it('cada cuadro existe como PNG del tamaño del lienzo común, sin láminas mezcladas ni huérfanos', () => {
    for (const id of FRAME_IDS) {
      const png = readFileSync(`${frames}/${id}.png`);
      expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
      expect(png.readUInt32BE(16)).toBe(FRAME_GEOMETRY.width);
      expect(png.readUInt32BE(20)).toBe(FRAME_GEOMETRY.height);
      expect(png[25], 'RGBA').toBe(6);
    }
    expect(readdirSync(frames).filter((file) => file.endsWith('.png')).sort()).toEqual(FRAME_IDS.map((id) => `${id}.png`).sort());
  });

  it('tienen transparencia real: esquinas y bordes sin fondo, alfa binaria y proporción de figura razonable', () => {
    for (const id of FRAME_IDS) {
      const { width, height, data } = readPng(`${frames}/${id}.png`);
      const alpha = (x: number, y: number): number => data[(y * width + x) * 4 + 3]!;
      for (const [x, y] of [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1], [3, 3], [width - 4, 3]] as const) expect(alpha(x, y), `${id} (${x},${y})`).toBe(0);
      let opaque = 0, partial = 0;
      for (let p = 3; p < data.length; p += 4) { if (data[p] === 255) opaque++; else if (data[p] !== 0) partial++; }
      expect(partial, `${id}: alfa binaria`).toBe(0);
      const share = opaque / (width * height);
      expect(share, `${id}: proporción de figura`).toBeGreaterThan(0.4);
      expect(share).toBeLessThan(0.85);
    }
  });

  it('cada gesto tiene un cuadro de boca cerrada y otro de boca abierta distintos, y el reposo parpadea', () => {
    for (const [base, [closed, open]] of Object.entries(TALK_FRAMES)) {
      expect(FRAME_IDS, base).toContain(closed); expect(FRAME_IDS, base).toContain(open); expect(closed).not.toBe(open);
    }
    expect(talkFrame('explain', true)).toBe('explain-talk'); expect(talkFrame('explain', false)).toBe('explain');
    expect(FRAME_IDS).toContain(IDLE_FRAME);
    for (const step of BLINK) expect(FRAME_IDS).toContain(step.frame);
    // Se cargan solo los cuadros que necesita un principio, no los 23.
    expect(framesOf(CHOREOGRAPHY.respeto).length).toBeLessThan(FRAME_IDS.length / 2);
  });

  it('baseAt elige el gesto según el avance de la voz', () => {
    const segments: TalkSegment[] = [{ from: 0, base: 'rest' }, { from: 0.5, base: 'point' }, { from: 0.9, base: 'fist' }];
    expect(baseAt(segments, 0)).toBe('rest'); expect(baseAt(segments, 0.49)).toBe('rest');
    expect(baseAt(segments, 0.5)).toBe('point'); expect(baseAt(segments, 0.95)).toBe('fist');
  });
});

describe('principios de trabajo y voz', () => {
  it('hay exactamente cinco principios con texto real, ordenados y con identificadores únicos', () => {
    expect(PRINCIPLES).toHaveLength(5);
    expect(PRINCIPLES.map((principle) => principle.order)).toEqual([1, 2, 3, 4, 5]);
    expect(new Set(PRINCIPLES.map((principle) => principle.id)).size).toBe(5);
    for (const principle of PRINCIPLES) {
      expect(principle.title.length).toBeGreaterThan(5); expect(principle.summary.length).toBeGreaterThan(10); expect(principle.narration.length).toBeGreaterThan(150);
    }
  });

  it('cada principio tiene su audio OGG y está al día con el texto (si cambias el texto, regenera la voz)', () => {
    for (const principle of PRINCIPLES) {
      const path = `public${principle.audio.src}`;
      expect(existsSync(path), path).toBe(true);
      const bytes = readFileSync(path);
      expect(bytes.subarray(0, 4).toString('ascii'), `${principle.id}: OGG`).toBe('OggS');
      expect(bytes.length).toBeGreaterThan(20_000);
      expect(principle.audio.durationMs).toBeGreaterThan(10_000); expect(principle.audio.durationMs).toBeLessThan(40_000);
      expect(principle.audio.textHash, `${principle.id}: audio desactualizado`).toBe(createHash('sha1').update(principle.narration).digest('hex').slice(0, 12));
    }
  });

  it('la línea de boca sigue la voz: cubre toda la duración y tiene un ritmo de habla natural', () => {
    for (const principle of PRINCIPLES) {
      const { mouth, durationMs, stepMs } = principle.audio;
      expect(Math.abs(mouth.length - durationMs / stepMs)).toBeLessThanOrEqual(6); // ≤150 ms (relleno propio de Opus)
      expect(mouth).toMatch(/^[01]+$/);
      const openShare = mouth.split('').filter((bit) => bit === '1').length / mouth.length;
      expect(openShare, `${principle.id}: proporción de boca abierta`).toBeGreaterThan(0.25); expect(openShare).toBeLessThan(0.75);
      const opens = (mouth.match(/1+/g) ?? []).length / (durationMs / 1000);
      expect(opens, `${principle.id}: aperturas por segundo`).toBeGreaterThan(2); expect(opens).toBeLessThan(7);
      // sin parpadeos de boca imposibles: ninguna apertura dura menos de 75 ms
      for (const run of mouth.match(/1+/g) ?? []) expect(run.length * stepMs).toBeGreaterThanOrEqual(75);
    }
  });

  it('cada principio tiene una coreografía distinta, que empieza en 0 y avanza en orden', () => {
    const signatures = PRINCIPLES.map((principle) => principle.choreography.map((segment) => `${segment.from}:${segment.base}`).join('|'));
    expect(new Set(signatures).size).toBe(5);
    for (const principle of PRINCIPLES) {
      const { choreography } = principle;
      expect(choreography[0]!.from).toBe(0);
      for (let i = 1; i < choreography.length; i++) { expect(choreography[i]!.from).toBeGreaterThan(choreography[i - 1]!.from); expect(choreography[i]!.from).toBeLessThan(1); }
      expect(new Set(choreography.map((segment) => segment.base)).size, `${principle.id}: usa varios gestos`).toBeGreaterThanOrEqual(2);
    }
  });
});
