import { FRAME_GEOMETRY, FRAME_IDS, type FrameId } from './frame-geometry';

// Manifiesto del tutor: qué cuadros existen y cómo se usan para hablar. Los cuadros PNG (transparentes, mismo lienzo
// y ancla en el cuello/cabeza) se generan con scripts/tutor/build.mjs a partir de las láminas de referencia guardadas
// en assets-src/tutor/referencias; la voz y su «línea de boca» con scripts/tutor/generate-principle-audio.mjs.
export { FRAME_GEOMETRY, FRAME_IDS };
export type { FrameId };
export const frameUrl = (id: FrameId): string => `/tutor/frames/${id}.png`;

// Reposo: sonrisa natural y parpadeo ocasional (medio cierre, cierre y reapertura).
export const IDLE_FRAME: FrameId = 'rest';
export const BLINK: readonly { frame: FrameId; ms: number }[] = [{ frame: 'rest-blink-half', ms: 70 }, { frame: 'rest-blink', ms: 90 }, { frame: 'rest-blink-half', ms: 70 }];
export const IDLE_BLINK_INTERVAL_MS = [3600, 6600] as const;

export type TutorExpression = 'guidance' | 'success' | 'support' | 'complete';
export const EXPRESSIONS: Record<TutorExpression, readonly { frame: FrameId; ms: number }[]> = {
  guidance: [{ frame: 'point-turn', ms: 350 }, { frame: 'point', ms: 900 }],
  success: [{ frame: 'affirm', ms: 380 }, { frame: 'affirm-nod', ms: 220 }, { frame: 'affirm', ms: 550 }],
  support: [{ frame: 'think', ms: 1000 }, { frame: 'rest-tilt', ms: 500 }],
  complete: [{ frame: 'celebrate-grin', ms: 850 }, { frame: 'affirm-nod', ms: 240 }, { frame: 'affirm', ms: 600 }],
};

// Gestos del cuerpo al hablar. Cada uno tiene dos cuadros con el mismo cuerpo: boca cerrada y boca abierta.
export type TalkBase = 'rest' | 'explain' | 'point' | 'fist';
export const TALK_FRAMES: Record<TalkBase, readonly [closed: FrameId, open: FrameId]> = {
  rest: ['rest', 'rest-talk'],            // brazos en reposo
  explain: ['explain', 'explain-talk'],   // palmas abiertas
  point: ['point', 'point-talk'],         // señala hacia el contenido
  fist: ['affirm', 'celebrate'],          // puño en alto: énfasis o cierre
};
export const talkFrame = (base: TalkBase, mouthOpen: boolean): FrameId => TALK_FRAMES[base][mouthOpen ? 1 : 0];

// Coreografía: a partir de qué fracción (0–1) de la voz el tutor cambia de gesto. Es independiente de la duración.
export type TalkSegment = { from: number; base: TalkBase };
export function baseAt(segments: readonly TalkSegment[], fraction: number): TalkBase {
  let base = segments[0]!.base;
  for (const segment of segments) if (fraction >= segment.from) base = segment.base;
  return base;
}
export function framesOf(segments: readonly TalkSegment[]): FrameId[] {
  const frames = new Set<FrameId>([IDLE_FRAME, ...BLINK.map((step) => step.frame)]);
  for (const { base } of segments) for (const frame of TALK_FRAMES[base]) frames.add(frame);
  return [...frames];
}
