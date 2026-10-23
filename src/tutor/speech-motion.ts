import { BLINK, talkFrame, type FrameId, type TalkBase } from './manifest';

// La envolvente de voz decide si hay habla. Los microcierres evitan dejar la boca
// inmóvil durante una vocal larga. Los parpadeos solo empiezan en pausas y en reposo.
export function createSpeechMotion() {
  let nextBlink = 3200;
  let blinkStart: number | null = null;
  let lastPosition = -1;
  function reset() { nextBlink = 3200; blinkStart = null; lastPosition = -1; }
  return {
    reset,
    frame(base: TalkBase, voiced: boolean, positionMs: number): FrameId {
      if (positionMs < lastPosition) reset();
      lastPosition = positionMs;
      if (base !== 'rest') blinkStart = null;
      if (blinkStart === null && base === 'rest' && !voiced && positionMs >= nextBlink) blinkStart = positionMs;
      if (blinkStart !== null) {
        let elapsed = positionMs - blinkStart;
        for (const step of BLINK) {
          if (elapsed < step.ms) return step.frame;
          elapsed -= step.ms;
        }
        blinkStart = null; nextBlink = positionMs + 4600;
      }
      const open = voiced && Math.floor(positionMs / 120) % 3 !== 2;
      return talkFrame(base, open);
    },
  };
}
