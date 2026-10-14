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
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(body.message ?? 'No se pudo completar la solicitud.');
  return body;
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

function cambiarContrasena(usuario: Usuario): void {
  shell('Protege tu cuenta', 'Antes de continuar, crea una contraseña personal de al menos 10 caracteres.', `
    <section class="auth-card narrow"><form id="password-form" class="auth-form">
      <label>Contraseña actual<input name="actual" type="password" autocomplete="current-password" required></label>
      <label>Nueva contraseña<input name="nueva" type="password" autocomplete="new-password" minlength="10" required></label>
      <button class="primary-action">Guardar y continuar</button><p id="feedback" class="feedback" role="alert" hidden></p>
    </form></section>`, usuario);
  document.querySelector<HTMLFormElement>('#password-form')!.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    try {
      const result = await api<{ usuario: Usuario }>('/auth/cambiar-contrasena', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      location.assign(result.usuario.ruta);
    } catch (error) { mensaje((error as Error).message, true); }
  });
}

function llenaTusDatos(usuario: Usuario): void {
  shell('Llena tus datos', 'Completa tu perfil e indícanos tu experiencia para asignarte la inducción adecuada.', `
    <section class="auth-card narrow"><div class="profile-summary"><strong>${escapar(usuario.nombreCompleto)}</strong><span>Documento ${escapar(usuario.numeroDocumento)}</span></div>
      <form id="profile-form" class="auth-form">
        <label>Tipo de documento<select name="tipoDocumento"><option value="CC">Cédula de ciudadanía</option><option value="CE">Cédula de extranjería</option><option value="PA">Pasaporte</option><option value="TI">Tarjeta de identidad</option></select></label>
        <label>Correo electrónico <small>Opcional</small><input name="correo" type="email" maxlength="150" value="${escapar(usuario.correo)}" autocomplete="email"></label>
        <label>Teléfono <small>Opcional</small><input name="telefono" type="tel" maxlength="30" value="${escapar(usuario.telefono)}" autocomplete="tel"></label>
        <fieldset class="experience-choice"><legend>¿Tienes experiencia en cobranzas digitales?</legend>
          <label><input type="radio" name="experiencia" value="true" required> Sí, tengo experiencia</label>
          <label><input type="radio" name="experiencia" value="false" required> No, estoy comenzando</label>
        </fieldset>
        <button class="primary-action">Guardar y continuar</button><p id="feedback" class="feedback" role="alert" hidden></p>
      </form>
    </section>`, usuario);
  const select = document.querySelector<HTMLSelectElement>('[name="tipoDocumento"]')!;
  select.value = usuario.tipoDocumento;
  document.querySelector<HTMLFormElement>('#profile-form')!.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = Object.fromEntries(new FormData(form));
    try {
      const result = await api<{ usuario: Usuario }>('/auth/completar-datos', {
        method: 'POST', body: JSON.stringify({
          correo: data.correo, telefono: data.telefono, tipoDocumento: data.tipoDocumento,
          tieneExperienciaCobranzasDigitales: data.experiencia === 'true',
        }),
      });
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
  if (!usuario) { formularioLogin(); return; }
  const route = usuario.ruta;
  if (location.pathname !== route && location.pathname !== '/app') { location.replace(route); return; }
  if (route === '/admin') { admin(usuario); return; }
  if (route === '/cambiar-contrasena') { cambiarContrasena(usuario); return; }
  if (route === '/llena-tus-datos') { llenaTusDatos(usuario); return; }
  if (location.pathname !== route) { location.replace(route); return; }
  document.body.hidden = false;
  document.body.insertAdjacentHTML('afterbegin', `<div class="training-session"><span>${escapar(usuario.nombreCompleto)} · ${usuario.tieneExperienciaCobranzasDigitales ? 'Ruta con experiencia' : 'Ruta sin experiencia'}</span><button id="training-logout" type="button">Cerrar sesión</button></div>`);
  document.querySelector('#training-logout')!.addEventListener('click', async () => { await api('/auth/logout', { method: 'POST' }); location.assign('/login'); });
  await import('./training');
}
