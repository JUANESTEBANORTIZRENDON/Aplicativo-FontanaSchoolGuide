import { describe, expect, it } from 'vitest';
import { createSpeechMotion } from './speech-motion';
import { EXPRESSIONS, FRAME_IDS, TALK_FRAMES } from './manifest';

describe('expresiones del tutor durante la narración', () => {
  it('abre la boca con voz y agrega microcierres durante sonidos sostenidos', () => {
    const motion = createSpeechMotion();
    expect(motion.frame('rest', true, 100)).toBe('rest-talk');
    expect(motion.frame('rest', true, 250)).toBe('rest');
    expect(motion.frame('rest', true, 370)).toBe('rest-talk');
    for (const base of ['rest', 'explain', 'point', 'fist'] as const) expect(motion.frame(base, false, 400)).toBe(TALK_FRAMES[base][0]);
  });
  it('parpadea en las pausas sin sustituir los gestos de explicar o señalar', () => {
    const motion = createSpeechMotion();
    expect(motion.frame('rest', true, 3200)).not.toContain('blink');
    expect(motion.frame('rest', false, 3300)).toBe('rest-blink-half');
    expect(motion.frame('rest', false, 3375)).toBe('rest-blink');
    expect(motion.frame('rest', false, 3465)).toBe('rest-blink-half');
    expect(motion.frame('rest', false, 3550)).toBe('rest');
    expect(motion.frame('point', false, 8500)).toBe('point');
    expect(motion.frame('explain', false, 8600)).toBe('explain');
  });
  it('reinicia el parpadeo al repetir o retroceder el audio', () => {
    const motion = createSpeechMotion();
    motion.frame('rest', false, 3400);
    expect(motion.frame('rest', false, 0)).toBe('rest');
    expect(motion.frame('rest', false, 3300)).toBe('rest-blink-half');
    motion.reset();
    expect(motion.frame('rest', false, 40)).toBe('rest');
  });
  it('usa poses existentes y breves: reflexión al corregir y celebración al completar', () => {
    expect(EXPRESSIONS.support[0]!.frame).toBe('think');
    expect(EXPRESSIONS.success.some(step => step.frame === 'affirm-nod')).toBe(true);
    expect(EXPRESSIONS.complete[0]!.frame).toBe('celebrate-grin');
    for (const sequence of Object.values(EXPRESSIONS)) {
      expect(sequence.reduce((sum, step) => sum + step.ms, 0)).toBeLessThan(2500);
      for (const step of sequence) expect(FRAME_IDS).toContain(step.frame);
    }
  });
});
