// Ingreso: franja oscura a la izquierda y tarjeta blanca que la cruza (logo + formulario).

import { brandLockup, schoolLogo } from '../components/Logo';
import { hydrateIcons, icon } from '../components/icons';
import { trainingNoticeTemplate } from '../components/TrainingNotice';
import type { SimContext } from '../context';
import { DEMO_CREDENTIALS } from '../data/catalogs';
import { combine, on, qs, type Cleanup } from '../utils/dom';
import { esc } from '../utils/format';

function template(): string {
  return `
    <div class="sim-login">
      <div class="sim-login__strip">${schoolLogo()}</div>
      <main class="sim-login__card" id="sim-main" tabindex="-1">
        <div class="sim-login__brand" data-sim-guide="login.marca">${brandLockup()}</div>
        <div class="sim-login__form-col">
          <form class="sim-login__form" novalidate data-sim-guide="login.formulario" aria-labelledby="sim-login-title">
            <h1 id="sim-login-title" class="sim-login__title">Iniciar sesión</h1>
            <p class="sim-form-summary" role="alert" aria-live="assertive" data-login-error></p>
            <label class="sim-visually-hidden" for="sim-login-doc">Documento</label>
            <input class="sim-input sim-input--login" id="sim-login-doc" name="document" inputmode="numeric"
              autocomplete="username" placeholder="Documento" aria-describedby="sim-login-doc-error" />
            <p class="sim-error" id="sim-login-doc-error" data-error="document"></p>
            <div class="sim-login__password">
              <label class="sim-visually-hidden" for="sim-login-pass">Contraseña</label>
              <input class="sim-input sim-input--login" id="sim-login-pass" name="password" type="password"
                autocomplete="current-password" placeholder="Contraseña" aria-describedby="sim-login-pass-error" />
              <button type="button" class="sim-login__eye" data-action="toggle-password" aria-pressed="false" aria-label="Mostrar contraseña">
                ${icon('EyeOff')}
              </button>
            </div>
            <p class="sim-error" id="sim-login-pass-error" data-error="password"></p>
            <button type="submit" class="sim-btn sim-btn--login">Ingresar al simulador</button>
          </form>

          <section class="sim-demo" data-sim-guide="login.credenciales" aria-labelledby="sim-demo-title">
            <h2 id="sim-demo-title" class="sim-demo__title">${icon('Info')} Credenciales de práctica</h2>
            <dl class="sim-demo__list">
              <div><dt>Documento</dt><dd><code>${esc(DEMO_CREDENTIALS.document)}</code></dd></div>
              <div><dt>Contraseña</dt><dd><code>${esc(DEMO_CREDENTIALS.password)}</code></dd></div>
            </dl>
            <div class="sim-demo__actions">
              <button type="button" class="sim-btn sim-btn--ghost sim-btn--sm" data-action="clear">Limpiar campos</button>
              <button type="button" class="sim-btn sim-btn--secondary sim-btn--sm" data-action="fill">Usar credenciales de práctica</button>
            </div>
          </section>
          ${trainingNoticeTemplate('inline', 'login.aviso')}
        </div>
      </main>
    </div>`;
}

export function renderLoginPage(ctx: SimContext, container: HTMLElement): Cleanup {
  ctx.setTitle('Iniciar sesión');
  container.innerHTML = template();
  hydrateIcons(container);

  const form = qs<HTMLFormElement>(container, '.sim-login__form');
  const doc = qs<HTMLInputElement>(form, '[name="document"]');
  const pass = qs<HTMLInputElement>(form, '[name="password"]');
  const eye = qs<HTMLButtonElement>(form, '[data-action="toggle-password"]');
  const summary = qs(form, '[data-login-error]');

  const setError = (field: 'document' | 'password', message: string): void => {
    qs(form, `[data-error="${field}"]`).textContent = message;
    const input = field === 'document' ? doc : pass;
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  };
  const clearErrors = (): void => {
    setError('document', '');
    setError('password', '');
    summary.textContent = '';
  };

  return combine([
    on(eye, 'click', () => {
      const show = pass.type === 'password';
      pass.type = show ? 'text' : 'password';
      eye.setAttribute('aria-pressed', String(show));
      eye.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
      eye.innerHTML = icon(show ? 'Eye' : 'EyeOff');
      hydrateIcons(eye);
    }),
    on(container, 'click', (event) => {
      const action = (event.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
      if (action === 'fill') {
        doc.value = DEMO_CREDENTIALS.document;
        pass.value = DEMO_CREDENTIALS.password;
        clearErrors();
        qs<HTMLButtonElement>(form, '[type="submit"]').focus();
      } else if (action === 'clear') {
        doc.value = '';
        pass.value = '';
        clearErrors();
        doc.focus();
      }
    }),
    on(form, 'submit', (event) => {
      event.preventDefault();
      clearErrors();
      const document = doc.value.trim();
      if (!/^\d{6,12}$/.test(document)) setError('document', 'Escribe el documento solo con números (6 a 12 dígitos).');
      if (!pass.value) setError('password', 'Escribe la contraseña.');
      if (doc.getAttribute('aria-invalid') || pass.getAttribute('aria-invalid')) {
        summary.textContent = 'Revisa los campos marcados.';
        (doc.getAttribute('aria-invalid') ? doc : pass).focus();
        return;
      }
      if (!ctx.store.login(document, pass.value)) {
        summary.textContent = 'Documento o contraseña incorrectos. Usa las credenciales de práctica.';
        pass.select();
        pass.focus();
        return;
      }
      ctx.navigate('/carteras');
    }),
  ]);
}
