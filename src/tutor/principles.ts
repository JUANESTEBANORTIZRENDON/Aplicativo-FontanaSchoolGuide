import content from './principles.json';
import { PRINCIPLE_AUDIO, PRINCIPLE_AUDIO_STEP_MS } from './principle-audio.generated';
import type { TalkSegment } from './manifest';

// «Principios de trabajo»: cinco ideas que el tutor explica con voz. El texto (título, resumen y narración) vive en
// principles.json; el audio y su línea de boca se generan a partir de ese texto (scripts/tutor/generate-principle-audio.mjs);
// aquí solo se define la coreografía: qué gesto hace el tutor en cada tramo de la explicación.
// El contenido es una PROPUESTA basada en los textos existentes de la inducción y está pendiente de validación por la empresa.
export type PrincipleId = keyof typeof PRINCIPLE_AUDIO;
export type Principle = {
  id: PrincipleId;
  order: number;
  title: string;
  summary: string;
  narration: string;
  audio: { src: string; durationMs: number; mouth: string; stepMs: number; textHash: string };
  choreography: readonly TalkSegment[];
};

// Cada principio combina los gestos de forma distinta (fracción de la voz → gesto).
export const CHOREOGRAPHY: Record<PrincipleId, readonly TalkSegment[]> = {
  respeto: [{ from: 0, base: 'rest' }, { from: 0.3, base: 'explain' }, { from: 0.66, base: 'rest' }, { from: 0.86, base: 'fist' }],
  informacion: [{ from: 0, base: 'rest' }, { from: 0.24, base: 'point' }, { from: 0.56, base: 'explain' }, { from: 0.82, base: 'rest' }],
  verificar: [{ from: 0, base: 'explain' }, { from: 0.3, base: 'rest' }, { from: 0.5, base: 'point' }, { from: 0.8, base: 'explain' }],
  claridad: [{ from: 0, base: 'rest' }, { from: 0.28, base: 'explain' }, { from: 0.58, base: 'fist' }, { from: 0.78, base: 'rest' }],
  compromiso: [{ from: 0, base: 'explain' }, { from: 0.3, base: 'point' }, { from: 0.62, base: 'fist' }],
};

export const PRINCIPLES: readonly Principle[] = content.items.map((item, index) => {
  const id = item.id as PrincipleId;
  const audio = PRINCIPLE_AUDIO[id];
  return { id, order: index + 1, title: item.title, summary: item.summary, narration: item.narration,
    audio: { src: audio.src, durationMs: audio.durationMs, mouth: audio.mouth, stepMs: PRINCIPLE_AUDIO_STEP_MS, textHash: audio.textHash },
    choreography: CHOREOGRAPHY[id] };
});
