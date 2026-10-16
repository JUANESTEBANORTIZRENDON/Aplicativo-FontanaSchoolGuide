import { api, escapar } from './http';
import { pasosCamino } from './learning-path';
import { revealApp, showAppLoading } from './loading';

type Usuario = {
  id: string;
  nombreCompleto: string;
  numeroDocumento: string;
  rol: string;
  estado: string;
  correo: string | null;
  telefono: string | null;
  tipoDocumento: string;
  debeCompletarDatos: boolean;
  debeCambiarPassword: boolean;
  tieneExperienciaCobranzasDigitales: boolean | null;
  historiaCompletada: boolean;
  metodoCompletado: boolean;
  ruta: string;
};

function mensaje(texto: string, error = false): void {
  const target = document.querySelector<HTMLElement>('#feedback');
  if (!target) return;
  target.textContent = texto;
  target.className = `feedback ${error ? 'feedback-error' : 'feedback-ok'}`;
  target.hidden = false;
}

function shell(title: string, subtitle: string, content: string, usuario?: Usuario): void {
  document.body.className = 'auth-screen';
  document.querySelector<HTMLElement>('#app-content')!.innerHTML = `
    <header class="auth-header">
      <a class="auth-brand" href="/"><img src="/imagenes/fontana-logo.png" alt=""><span>FONTANA <small>SCHOOL</small></span></a>
      ${usuario ? `<div class="auth-account"><span>${escapar(usuario.nombreCompleto)}</span><button type="button" id="logout" class="text-button">Cerrar sesión</button></div>` : ''}
    </header>
    <main class="auth-main"><div class="auth-intro"><p class="auth-kicker">FONTANA SCHOOL</p><h1>${title}</h1><p>${subtitle}</p></div>${content}</main>
  `;
  document.body.hidden = false;
  document.querySelector('#logout')?.addEventListener('click', async () => {
    await api('/auth/logout', { method: 'POST' });
    location.assign('/login');
  });
}

// Identidad compartida por el acceso y el formulario del primer ingreso.
function aplicarEstiloAcceso(): void {
  document.body.classList.add('auth-login', 'login-motion');
  document.querySelector('.auth-intro')!.remove();
  document.querySelector('.auth-brand')!.innerHTML = '<img src="/imagenes/fontana-logo.png" alt="Fontana"><span>Aula de formación</span>';
}

function formularioLogin(): void {
  shell('', '', `
    <div class="login-panel">
    <section class="login-welcome" aria-label="Bienvenida a Fontana">
      <figure class="login-photo">
        <img src="/imagenes/fontana-school-login.png" alt="Fontana School, identidad dorada sobre fondo vino">
      </figure>
    </section>
    <section class="auth-card narrow login-card" aria-labelledby="login-title">
      <h1 id="login-title">Inicia tu sesión</h1>
      <div class="role-tabs" role="tablist" aria-label="Tipo de acceso">
        <button type="button" class="role-tab active" data-role="asesor" aria-selected="true">Soy asesor</button>
        <button type="button" class="role-tab" data-role="administrador" aria-selected="false">Administración</button>
      </div>
      <form id="login-form" class="auth-form">
        <input type="hidden" name="tipo" value="asesor">
        <label><span id="identity-label">Número de documento</span><input name="identificador" required autocomplete="username" maxlength="150" placeholder="Escribe tu documento"></label>
        <div class="password-field">
          <label for="login-password">Contraseña</label>
          <div class="password-control">
            <input id="login-password" name="password" type="password" required autocomplete="current-password" placeholder="Escribe tu contraseña">
            <button class="password-toggle" type="button" aria-label="Mostrar contraseña" aria-pressed="false" aria-controls="login-password">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path class="eye-slash" d="M3 3l18 18"/></svg>
            </button>
          </div>
        </div>
        <button class="primary-action" type="submit"><span class="login-submit-label" aria-live="polite">Ingresar</span><span class="login-submit-arrow" aria-hidden="true">→</span><span class="login-spinner" aria-hidden="true" hidden></span></button>
        <p id="feedback" class="feedback" role="alert" hidden></p>
      </form>
    </section></div>`);
  aplicarEstiloAcceso();
  const form = document.querySelector<HTMLFormElement>('#login-form')!;
  const passwordInput = form.elements.namedItem('password') as HTMLInputElement;
  const passwordToggle = form.querySelector<HTMLButtonElement>('.password-toggle')!;
  passwordToggle.addEventListener('click', () => {
    const visible = passwordInput.type === 'password';
    passwordInput.type = visible ? 'text' : 'password';
    passwordToggle.setAttribute('aria-pressed', String(visible));
    passwordToggle.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });
  let submitting = false;
  function setSubmitting(busy: boolean): void {
    submitting = busy;
    form.setAttribute('aria-busy', String(busy));
    form.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled = busy;
    form.querySelector('.login-submit-label')!.textContent = busy ? 'Ingresando…' : 'Ingresar';
    form.querySelector<HTMLElement>('.login-submit-arrow')!.hidden = busy;
    form.querySelector<HTMLElement>('.login-spinner')!.hidden = !busy;
    document.querySelectorAll<HTMLButtonElement>('.role-tab').forEach((tab) => { tab.disabled = busy; });
  }
  document.querySelectorAll<HTMLButtonElement>('.role-tab').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll<HTMLButtonElement>('.role-tab').forEach((tab) => {
      tab.classList.toggle('active', tab === button);
      tab.setAttribute('aria-selected', String(tab === button));
    });
    (form.elements.namedItem('tipo') as HTMLInputElement).value = button.dataset.role!;
    document.querySelector('#identity-label')!.textContent = button.dataset.role === 'asesor' ? 'Número de documento' : 'Documento o correo administrativo';
    (form.elements.namedItem('identificador') as HTMLInputElement).placeholder = button.dataset.role === 'asesor' ? 'Escribe tu documento' : 'Documento o correo';
  }));
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting) return;
    const data = Object.fromEntries(new FormData(form));
    setSubmitting(true);
    document.querySelector<HTMLElement>('#feedback')!.hidden = true;
    try {
      const result = await api<{ usuario: Usuario }>('/auth/login', { method: 'POST', body: JSON.stringify(data) });
      showAppLoading('Iniciando tu sesión…');
      location.assign(result.usuario.ruta);
    } catch (error) { mensaje((error as Error).message, true); setSubmitting(false); }
  });
}

function llenaTusDatos(usuario: Usuario): void {
  shell('', '', `
    <div class="login-panel">
      <section class="auth-card narrow login-card" aria-labelledby="profile-title">
      <h1 id="profile-title">Completa tus datos</h1>
      <p class="profile-intro">Un último paso antes de comenzar tu inducción.</p>
      <div class="profile-summary"><strong>${escapar(usuario.nombreCompleto)}</strong><span>Documento ${escapar(usuario.numeroDocumento)}</span></div>
      <form id="profile-form" class="auth-form">
        <label>Correo electrónico<input name="correo" type="email" required maxlength="150" value="${escapar(usuario.correo)}" autocomplete="email" placeholder="nombre@empresa.com"></label>
        <label>Teléfono <small>Opcional</small><input name="telefono" type="tel" maxlength="30" value="${escapar(usuario.telefono)}" autocomplete="tel"></label>
        <button class="primary-action">Guardar y continuar</button><p id="feedback" class="feedback" role="alert" hidden></p>
      </form>
      <button type="button" class="profile-back" id="profile-back-login">← Volver al inicio de sesión</button>
    </section></div>`, usuario);
  aplicarEstiloAcceso();
  document.body.classList.add('auth-profile');
  document.querySelector('.auth-account')?.remove();
  const profileForm = document.querySelector<HTMLFormElement>('#profile-form')!;
  const draftKey = `fontana-profile-draft:${usuario.id}`;
  const correoInput = profileForm.elements.namedItem('correo') as HTMLInputElement;
  const telefonoInput = profileForm.elements.namedItem('telefono') as HTMLInputElement;
  const backToLogin = document.querySelector<HTMLButtonElement>('#profile-back-login')!;
  backToLogin.addEventListener('click', async () => {
    if (backToLogin.disabled) return;
    backToLogin.disabled = true;
    backToLogin.textContent = 'Cerrando sesión…';
    try {
      await api('/auth/logout', { method: 'POST' });
      showAppLoading('Volviendo al inicio de sesión…');
      location.replace('/login');
    } catch (error) {
      mensaje((error as Error).message, true);
      backToLogin.disabled = false;
      backToLogin.textContent = '← Volver al inicio de sesión';
    }
  });
  try {
    const draft = JSON.parse(sessionStorage.getItem(draftKey) ?? 'null') as { correo?: unknown; telefono?: unknown } | null;
    if (typeof draft?.correo === 'string') correoInput.value = draft.correo;
    if (typeof draft?.telefono === 'string') telefonoInput.value = draft.telefono;
  } catch { /* El formulario sigue funcionando si el navegador bloquea el almacenamiento. */ }
  const correo = document.querySelector<HTMLInputElement>('[name="correo"]')!;
  correo.addEventListener('input', () => {
    correo.setCustomValidity(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.value.trim())
      ? '' : 'Ingresa un correo válido con @ y dominio, por ejemplo nombre@empresa.com.');
  });
  correo.addEventListener('invalid', () => {
    correo.setCustomValidity('Ingresa un correo válido con @ y dominio, por ejemplo nombre@empresa.com.');
  });
  document.querySelector<HTMLFormElement>('#profile-form')!.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form));
    try {
      sessionStorage.setItem(draftKey, JSON.stringify({ correo: data.correo, telefono: data.telefono }));
    } catch { /* Guardar el perfil no depende del almacenamiento del navegador. */ }
    try {
      const result = await api<{ usuario: Usuario }>('/auth/completar-datos', {
        method: 'POST', body: JSON.stringify({
          correo: data.correo, telefono: data.telefono,
        }),
      });
      try { sessionStorage.removeItem(draftKey); } catch { /* Sin almacenamiento disponible. */ }
      location.assign(result.usuario.ruta);
    } catch (error) { mensaje((error as Error).message, true); }
  });
}

async function admin(usuario: Usuario): Promise<void> {
  const { renderAdmin } = await import('./admin/admin');
  renderAdmin((title, subtitle, content) => shell(title, subtitle, content, usuario));
}

export async function iniciarInterfaz(): Promise<void> {
  let usuario: Usuario | null = null;
  try { usuario = (await api<{ usuario: Usuario }>('/auth/me')).usuario; } catch { /* Sin sesión. */ }
  if (!usuario) { formularioLogin(); await revealApp(); return; }
  const route = usuario.ruta;
  const practiceRoute = route === '/practica' || route === '/practica/nuevo' || route === '/practica/experiencia';
  const reviewing = practiceRoute && location.pathname === '/induccion';
  // Subrutas de la ruta de formación: el servidor valida el acceso a cada módulo.
  // Módulo 1 (Ofimática para tus cobranzas): tiene su propia aplicación con cinco secciones.
  const officeMatch = /^\/induccion\/modulos\/ofimatica-mecanografia(?:\/(bienvenida|mecanografia|excel|ortografia|resultado))?\/?$/.exec(location.pathname);
  const officeRoute = Boolean(officeMatch) && (route === '/induccion' || practiceRoute);
  const advisorSubroute = !officeRoute && (route === '/induccion' || practiceRoute) && /^\/induccion\/(modulos\/[a-z0-9-]+|certificado)\/?$/.test(location.pathname);
  if (location.pathname !== route && location.pathname !== '/app' && !reviewing && !advisorSubroute && !officeRoute) { location.replace(route); return; }
  if (route === '/admin') { await admin(usuario); await revealApp(); return; }
  if (route === '/llena-tus-datos') { llenaTusDatos(usuario); await revealApp(); return; }
  if (officeRoute) {
    const { mountOffice } = await import('./office/office');
    await mountOffice(usuario.nombreCompleto, (officeMatch![1] as import('./office/api').SectionKey | undefined) ?? null, route);
    await revealApp();
    return;
  }
  if (advisorSubroute) {
    shell('Tu ruta de formación', 'Fontana School · Inducción', '<div id="module-page"></div>', usuario);
    const { renderModulePage } = await import('./advisor/advisor');
    await renderModulePage(document.querySelector<HTMLElement>('#module-page')!, practiceRoute ? route : '/induccion', usuario.tieneExperienciaCobranzasDigitales);
    await revealApp();
    return;
  }
  if (practiceRoute && !reviewing) {
    const { mostrarPractica } = await import('./practice');
    mostrarPractica(usuario.nombreCompleto, usuario.tieneExperienciaCobranzasDigitales, route);
    const { mountLearningPath } = await import('./advisor/advisor');
    await mountLearningPath();
    await revealApp();
    return;
  }
  if (location.pathname !== route && !reviewing) { location.replace(route); return; }
  const { mountHeaderAccount } = await import('./header-account');
  mountHeaderAccount(usuario.nombreCompleto, 'Inducción Fontana');
  // "Tu camino en Fontana": con la práctica ya asignada, el paso 02 lleva de vuelta a ella.
  document.querySelector('.learning-path ol')!.outerHTML = pasosCamino('empresa', practiceRoute ? route : null);
  const { restoreProgress } = await import('./training');
  restoreProgress({ historia: usuario.historiaCompletada, metodo: usuario.metodoCompletado, completada: practiceRoute });
  await revealApp();
}
