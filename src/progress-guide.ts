import './progress-guide.css';
import { escapar } from './http';

/** Acceso compartido al progreso del aula desde los cinco módulos. */
export function progressGuide(backHref: string): string {
  return `<a href="${escapar(backHref)}" class="fontana-progress-guide" aria-label="Dale una vista a tu progreso del aula">
    <img src="/tutor/frames/point-turn.png" alt="" width="96" height="110" draggable="false">
    <span class="fontana-progress-sign">Dale una vista a tu progreso <span aria-hidden="true">→</span></span>
  </a>`;
}
