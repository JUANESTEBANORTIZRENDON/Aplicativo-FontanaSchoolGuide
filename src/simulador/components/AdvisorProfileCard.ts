import { displayAdvisor, PRACTICE_ADVISOR } from '../data/catalogs';
import { esc, formatDate } from '../utils/format';
import { icon } from './icons';
import { advisorsIllustration } from './Logo';

/** Perfil del asesor (zona superior del Dashboard de Control Next). */
export function advisorProfileTemplate(today: Date): string {
  const a = PRACTICE_ADVISOR;
  const who = displayAdvisor();
  return `
    <section class="sim-profile-card" aria-labelledby="sim-advisor-name">
      <div class="sim-profile-card__aside">
        ${advisorsIllustration(210)}
        <p class="sim-alert sim-alert--warning" data-sim-guide="carteras.extension">
          ${icon('X')} Extensión de práctica: no realiza llamadas reales
        </p>
      </div>
      <div class="sim-profile-card__main" data-sim-guide="carteras.perfil">
        <h1 id="sim-advisor-name" class="sim-profile-card__name"><strong>${esc(who.firstName)}</strong> ${esc(who.lastNames)}</h1>
        <p class="sim-profile-card__role">${icon('UserRound')} ${esc(a.role)}</p>
        <p class="sim-profile-card__contact">
          <span>${icon('Mail')} <strong>Email:</strong> ${esc(a.email)}</span>
          <span>${icon('IdCard')} <strong>Cédula de Ciudadanía:</strong> ${esc(a.document)}</span>
        </p>
        <dl class="sim-profile-card__facts">
          <div><dt>Extension</dt><dd>${esc(a.extension)}</dd></div>
          <div><dt>Telefono</dt><dd>${esc(a.phone.replace(/\s/g, ''))}</dd></div>
          <div><dt>Fecha de práctica</dt><dd>${esc(formatDate(today))}</dd></div>
        </dl>
      </div>
    </section>`;
}
