import { api, escapar } from './http';

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
  document.body.innerHTML = `
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

function formularioLogin(): void {
  shell('Bienvenido de nuevo', 'Ingresa con las credenciales asignadas a tu perfil.', `
    <section class="auth-card narrow">
      <div class="role-tabs" role="tablist" aria-label="Tipo de acceso">
        <button type="button" class="role-tab active" data-role="asesor" aria-selected="true">Soy asesor</button>
        <button type="button" class="role-tab" data-role="administrador" aria-selected="false">Administración</button>
      </div>
      <form id="login-form" class="auth-form">
        <input type="hidden" name="tipo" value="asesor">
        <label><span id="identity-label">Número de documento</span><input name="identificador" required autocomplete="username" maxlength="150" placeholder="Escribe tu documento"></label>
        <label>Contraseña<input name="password" type="password" required autocomplete="current-password" placeholder="Escribe tu contraseña"></label>
        <button class="primary-action" type="submit">Ingresar <span aria-hidden="true">→</span></button>
        <p id="feedback" class="feedback" role="alert" hidden></p>
      </form>
    </section>`);
  const form = document.querySelector<HTMLFormElement>('#login-form')!;
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
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    button.disabled = true;
    const data = Object.fromEntries(new FormData(form));
    try {
      const result = await api<{ usuario: Usuario }>('/auth/login', { method: 'POST', body: JSON.stringify(data) });
      location.assign(result.usuario.ruta);
    } catch (error) { mensaje((error as Error).message, true); button.disabled = false; }
  });
}

function llenaTusDatos(usuario: Usuario): void {
  shell('Llena tus datos', 'Completa tus datos de contacto para continuar con la inducción.', `
    <section class="auth-card narrow"><div class="profile-summary"><strong>${escapar(usuario.nombreCompleto)}</strong><span>Documento ${escapar(usuario.numeroDocumento)}</span></div>
      <form id="profile-form" class="auth-form">
        <label>Correo electrónico<input name="correo" type="email" required maxlength="150" value="${escapar(usuario.correo)}" autocomplete="email" placeholder="nombre@empresa.com"></label>
        <label>Teléfono <small>Opcional</small><input name="telefono" type="tel" maxlength="30" value="${escapar(usuario.telefono)}" autocomplete="tel"></label>
        <button class="primary-action">Guardar y continuar</button><p id="feedback" class="feedback" role="alert" hidden></p>
      </form>
    </section>`, usuario);
  const profileForm = document.querySelector<HTMLFormElement>('#profile-form')!;
  const draftKey = `fontana-profile-draft:${usuario.id}`;
  const correoInput = profileForm.elements.namedItem('correo') as HTMLInputElement;
  const telefonoInput = profileForm.elements.namedItem('telefono') as HTMLInputElement;
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
  if (!usuario) { formularioLogin(); return; }
  const route = usuario.ruta;
  const advisorSubroute = route === '/induccion' && /^\/induccion\/(modulos\/[a-z0-9-]+|certificado)\/?$/.test(location.pathname);
  if (location.pathname !== route && location.pathname !== '/app' && !advisorSubroute) { location.replace(route); return; }
  if (route === '/admin') { await admin(usuario); return; }
  if (route === '/llena-tus-datos') { llenaTusDatos(usuario); return; }
  if (advisorSubroute) {
    shell('Tu ruta de formación', 'Fontana School · Inducción', '<div id="module-page"></div>', usuario);
    const { renderModulePage } = await import('./advisor/advisor');
    await renderModulePage(document.querySelector<HTMLElement>('#module-page')!);
    return;
  }
  if (location.pathname !== route) { location.replace(route); return; }
  document.body.hidden = false;
  document.body.insertAdjacentHTML('afterbegin', `<div class="training-session"><span>${escapar(usuario.nombreCompleto)} · Inducción Fontana</span><button id="training-logout" type="button">Cerrar sesión</button></div>`);
  document.querySelector('#training-logout')!.addEventListener('click', async () => { await api('/auth/logout', { method: 'POST' }); location.assign('/login'); });
  await import('./training');
  const { mountLearningPath } = await import('./advisor/advisor');
  await mountLearningPath();
}
