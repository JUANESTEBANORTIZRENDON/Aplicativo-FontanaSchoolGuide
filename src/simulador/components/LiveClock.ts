import type { Cleanup } from '../utils/dom';
import { icon } from './icons';

const formatter = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
});

/** Hora de Bogotá en formato `hh:mm:ss a. m.`. */
export function formatClock(date: Date): string {
  const parts = formatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes): string => parts.find((p) => p.type === type)?.value ?? '';
  // Como en Control Next: 09:02:30 AM.
  const raw = get('dayPeriod').replace(/[\s.]/g, '').toUpperCase();
  const period = raw.startsWith('P') ? 'PM' : raw.startsWith('A') ? 'AM' : Number(get('hour')) < 12 ? 'AM' : 'PM';
  return `${get('hour').padStart(2, '0')}:${get('minute')}:${get('second')} ${period}`;
}

/** `pill`: píldora con borde y reloj (vistas de cartera). `plain`: hora grande (selección de carteras). */
export function liveClockTemplate(variant: 'pill' | 'plain'): string {
  const now = formatClock(new Date());
  if (variant === 'plain') {
    return `
      <div class="sim-clock sim-clock--plain" data-sim-guide="comun.reloj">
        <time class="sim-clock__time" data-clock>${now}</time>
        <span class="sim-clock__city">Bogotá, Colombia</span>
      </div>`;
  }
  return `
    <div class="sim-clock sim-clock--pill" data-sim-guide="comun.reloj">
      ${icon('Clock', 'sim-clock__icon')}
      <div>
        <span class="sim-clock__city">Bogotá, Colombia</span>
        <time class="sim-clock__time" data-clock>${now}</time>
      </div>
    </div>`;
}

/** Actualiza cada segundo los relojes dentro de `root`. */
export function mountLiveClock(root: ParentNode): Cleanup {
  const tick = (): void => {
    const text = formatClock(new Date());
    for (const el of root.querySelectorAll<HTMLElement>('[data-clock]')) el.textContent = text;
  };
  tick();
  const timer = setInterval(tick, 1000);
  return () => clearInterval(timer);
}
