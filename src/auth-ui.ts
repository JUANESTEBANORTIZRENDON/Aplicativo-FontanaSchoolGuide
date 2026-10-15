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
  ruta: string;
};
type Asesor = Usuario & { fechaCreacion: string };

function escapar(value: string | null | undefined): string {
  return (value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const unavailable = 'No se pudo conectar con el servidor. Verifica que Fontana School esté iniciado e intenta nuevamente.';
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch {
    throw new Error(unavailable);
  }
  if (response.status === 204) return undefined as T;
  if (response.status === 401 && path !== '/auth/login' && path !== '/auth/me') {
    location.assign('/login');
    throw new Error('Tu sesión venció. Inicia sesión nuevamente para continuar.');
  }
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(response.status >= 500 ? unavailable : 'El servidor devolvió una respuesta no válida. Intenta nuevamente.');
  }
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body ? body.message : undefined;
    throw new Error(typeof message === 'string' ? message : 'No se pudo completar la solicitud.');
  }
  return body as T;
}

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

function admin(usuario: Usuario): void {
  shell('Panel de administración', 'Gestiona las cuentas de asesores desde un solo lugar.', `
    <div class="admin-layout"><aside class="admin-nav"><strong>Gestión de usuarios</strong><a class="selected" href="/admin">Asesores</a><p>Los asesores nuevos quedan activos y completan su perfil al ingresar.</p></aside>
    <div class="admin-content">
      <section class="auth-card admin-card"><div class="section-title"><div><h2>Registrar asesor</h2><p>Completa los tres datos obligatorios.</p></div></div>
        <form id="create-form" class="admin-form">
          <label>Nombre completo<input name="nombreCompleto" required maxlength="150" autocomplete="name" placeholder="Nombre y apellidos"></label>
          <label>Número de documento<input name="numeroDocumento" required maxlength="30" inputmode="numeric" placeholder="Cédula"></label>
          <label>Contraseña temporal<input name="password" type="password" required minlength="10" maxlength="128" autocomplete="new-password" placeholder="Mínimo 10 caracteres"></label>
          <button class="primary-action">Crear asesor</button>
        </form><p id="feedback" class="feedback" role="status" hidden></p>
      </section>
      <section class="auth-card admin-card"><div class="section-title"><div><h2>Asesores registrados</h2><p id="total-caption">Cargando usuarios...</p></div></div>
        <form id="search-form" class="search-form"><input name="buscar" type="search" placeholder="Buscar por nombre o documento" aria-label="Buscar asesores"><button type="submit">Buscar</button></form>
        <div class="table-wrap"><table><thead><tr><th>Asesor</th><th>Documento</th><th>Estado</th><th>Perfil</th><th>Acciones</th></tr></thead><tbody id="advisor-rows"></tbody></table></div>
        <div class="pagination"><button id="prev-page" type="button">Anterior</button><span id="page-label"></span><button id="next-page" type="button">Siguiente</button></div>
      </section>
    </div></div>
    <dialog id="edit-dialog" class="edit-dialog"><form id="edit-form" class="auth-form">
      <h2>Editar asesor</h2><p>Actualiza los datos de identificación.</p>
      <label>Nombre completo<input name="nombreCompleto" required maxlength="150"></label>
      <label>Número de documento<input name="numeroDocumento" required maxlength="30"></label>
      <div class="dialog-actions"><button type="button" id="cancel-edit" class="secondary-action">Cancelar</button><button class="primary-action">Guardar cambios</button></div>
      <p id="edit-feedback" class="feedback feedback-error" role="alert" hidden></p>
    </form></dialog>`, usuario);
  const create = document.querySelector<HTMLFormElement>('#create-form')!;
  const dialog = document.querySelector<HTMLDialogElement>('#edit-dialog')!;
  const editForm = document.querySelector<HTMLFormElement>('#edit-form')!;
  let editing: Asesor | null = null;
  document.querySelector('#cancel-edit')!.addEventListener('click', () => dialog.close());
  editForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!editing) return;
    const data = Object.fromEntries(new FormData(editForm));
    try {
      await api(`/admin/asesores/${editing.id}`, { method: 'PUT', body: JSON.stringify({ ...data, estado: editing.estado }) });
      dialog.close(); mensaje('Asesor actualizado.'); await load();
    } catch (error) {
      const target = document.querySelector<HTMLElement>('#edit-feedback')!;
      target.textContent = (error as Error).message;
      target.hidden = false;
    }
  });
  let page = 1;
  let search = '';
  async function load(): Promise<void> {
    const data = await api<{ asesores: Asesor[]; total: number; paginas: number; pagina: number }>(`/admin/asesores?pagina=${page}&buscar=${encodeURIComponent(search)}`);
    document.querySelector('#total-caption')!.textContent = `${data.total} asesor${data.total === 1 ? '' : 'es'} registrado${data.total === 1 ? '' : 's'}`;
    document.querySelector('#page-label')!.textContent = `Página ${data.pagina} de ${data.paginas}`;
    (document.querySelector<HTMLButtonElement>('#prev-page')!).disabled = page <= 1;
    (document.querySelector<HTMLButtonElement>('#next-page')!).disabled = page >= data.paginas;
    const rows = document.querySelector<HTMLTableSectionElement>('#advisor-rows')!;
    rows.innerHTML = data.asesores.length ? data.asesores.map((item) => `<tr>
      <td><strong>${escapar(item.nombreCompleto)}</strong></td><td>${escapar(item.numeroDocumento)}</td>
      <td><span class="status ${item.estado === 'activo' ? 'is-active' : 'is-inactive'}">${escapar(item.estado)}</span></td>
      <td>${item.debeCompletarDatos ? 'Pendiente' : 'Completo'}</td>
      <td><button class="row-action" data-action="edit" data-id="${item.id}">Editar</button><button class="row-action" data-action="toggle" data-id="${item.id}">${item.estado === 'activo' ? 'Desactivar' : 'Activar'}</button></td>
    </tr>`).join('') : '<tr><td colspan="5" class="empty-row">No hay asesores para mostrar.</td></tr>';
    rows.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => button.addEventListener('click', async () => {
      const item = data.asesores.find((value) => value.id === button.dataset.id)!;
      if (button.dataset.action === 'edit') {
        editing = item;
        (editForm.elements.namedItem('nombreCompleto') as HTMLInputElement).value = item.nombreCompleto;
        (editForm.elements.namedItem('numeroDocumento') as HTMLInputElement).value = item.numeroDocumento;
        document.querySelector<HTMLElement>('#edit-feedback')!.hidden = true;
        dialog.showModal();
      } else {
        const nextState = item.estado === 'activo' ? 'inactivo' : 'activo';
        if (!confirm(`${nextState === 'inactivo' ? 'Desactivar' : 'Activar'} a ${item.nombreCompleto}?`)) return;
        try {
          if (nextState === 'inactivo') await api(`/admin/asesores/${item.id}`, { method: 'DELETE' });
          else await api(`/admin/asesores/${item.id}`, { method: 'PUT', body: JSON.stringify({ nombreCompleto: item.nombreCompleto, numeroDocumento: item.numeroDocumento, estado: 'activo' }) });
          mensaje(`Asesor ${nextState === 'activo' ? 'activado' : 'desactivado'}.`); await load();
        } catch (error) { mensaje((error as Error).message, true); }
      }
    }));
  }
  create.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = create.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    button.disabled = true;
    try {
      await api('/admin/asesores', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(create))) });
      create.reset(); page = 1; mensaje('Asesor creado y activo. Puede iniciar sesión con su documento y contraseña.'); await load();
    } catch (error) { mensaje((error as Error).message, true); }
    finally { button.disabled = false; }
  });
  document.querySelector<HTMLFormElement>('#search-form')!.addEventListener('submit', (event) => {
    event.preventDefault(); search = String(new FormData(event.currentTarget as HTMLFormElement).get('buscar') ?? ''); page = 1; void load().catch((error) => mensaje((error as Error).message, true));
  });
  document.querySelector('#prev-page')!.addEventListener('click', () => { page--; void load().catch((error) => mensaje((error as Error).message, true)); });
  document.querySelector('#next-page')!.addEventListener('click', () => { page++; void load().catch((error) => mensaje((error as Error).message, true)); });
  void load().catch((error) => mensaje((error as Error).message, true));
}

export async function iniciarInterfaz(): Promise<void> {
  let usuario: Usuario | null = null;
  try { usuario = (await api<{ usuario: Usuario }>('/auth/me')).usuario; } catch { /* Sin sesión. */ }
  if (!usuario) { formularioLogin(); await revealApp(); return; }
  const route = usuario.ruta;
  if (location.pathname !== route && location.pathname !== '/app') { location.replace(route); return; }
  if (route === '/admin') { admin(usuario); await revealApp(); return; }
  if (route === '/llena-tus-datos') { llenaTusDatos(usuario); await revealApp(); return; }
  if (location.pathname !== route) { location.replace(route); return; }
  document.querySelector('#app-content')!.insertAdjacentHTML('afterbegin', `<div class="training-session"><span>${escapar(usuario.nombreCompleto)} · Inducción Fontana</span><button id="training-logout" type="button">Cerrar sesión</button></div>`);
  document.querySelector('#training-logout')!.addEventListener('click', async () => { await api('/auth/logout', { method: 'POST' }); location.assign('/login'); });
  await import('./training');
  await revealApp();
}
