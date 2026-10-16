import { PRACTICE_ADVISOR } from '../data/catalogs';
import { esc, formatDate } from '../utils/format';
import { icon } from './icons';

/** Perfil del asesor ficticio (zona superior de la selección de carteras). */
export function advisorProfileTemplate(today: Date): string {
  const a = PRACTICE_ADVISOR;
  return `
    <section class="sim-profile-card" aria-labelledby="sim-advisor-name">
      <div class="sim-profile-card__aside">
        <div class="sim-avatar sim-avatar--xl" aria-hidden="true">${icon('UserRound')}</div>
        <p class="sim-alert sim-alert--warning" data-sim-guide="carteras.extension">
          ${icon('TriangleAlert')} Extensión simulada: no realiza llamadas reales
        </p>
      </div>
      <div class="sim-profile-card__main" data-sim-guide="carteras.perfil">
        <h1 id="sim-advisor-name" class="sim-profile-card__name"><strong>${esc(a.firstName)}</strong> ${esc(a.lastNames)}</h1>
        <p class="sim-profile-card__role">${icon('UserRound')} ${esc(a.role)}</p>
        <p class="sim-profile-card__contact">
          <span>${icon('Mail')} <strong>Correo:</strong> ${esc(a.email)}</span>
          <span>${icon('IdCard')} <strong>Documento:</strong> ${esc(a.document)}</span>
        </p>
        <dl class="sim-profile-card__facts">
          <div><dt>Extensión</dt><dd>${esc(a.extension)}</dd></div>
          <div><dt>Teléfono</dt><dd>${esc(a.phone)}</dd></div>
          <div><dt>Fecha de práctica</dt><dd>${esc(formatDate(today))}</dd></div>
        </dl>
      </div>
    </section>`;
}
