import './admin.css';
import { api, escapar, formatDate } from '../http';

// Panel administrativo. Navegación por hash dentro de /admin:
// #asesores, #ficha/<id>, #modulos, #metricas, #auditoria.

type Usuario = { id: string; nombreCompleto: string; numeroDocumento: string; rol: string; estado: string; correo: string | null; telefono: string | null; debeCompletarDatos: boolean; fechaCreacion: string; ultimoAcceso: string | null };
type Shell = (title: string, subtitle: string, content: string) => void;
type Page<T> = { data: T[]; meta: { nextCursor: string | null; total?: number } };

const STATUS_TEXT: Record<string, string> = {
  NOT_STARTED: 'Sin iniciar', AVAILABLE: 'Disponible', IN_PROGRESS: 'En curso', PASSED: 'Aprobado', FAILED: 'Sin intentos', BLOCKED: 'Bloqueado',
  ACTIVE: 'Activo', INACTIVE: 'Inactivo', DRAFT: 'Borrador', ARCHIVED: 'Archivado', REVOKED: 'Anulado', REISSUED: 'Reemitido',
  SUBMITTED: 'Enviado', CANCELLED: 'Cancelado', VIGENTE: 'Vigente', VENCIDA: 'Vencida', REVOCADA: 'Revocada', CONSUMIDA: 'Consumida',
};
const ACTION_TEXT: Record<string, string> = {
  REACTIVATE: 'Reactivar actividad', EXTRA_ATTEMPT: 'Intento adicional', RESET_WAIT: 'Quitar tiempo de espera', UNLOCK: 'Desbloquear módulo', REOPEN_MODULE: 'Reabrir módulo',
};

const text = (value: string) => STATUS_TEXT[value] ?? value;
const badge = (value: string) => `<span class="status status-${escapar(value.toLowerCase())}">${escapar(text(value))}</span>`;
const empty = (columns: number, message = 'Sin registros.') => `<tr><td colspan="${columns}" class="empty-row">${message}</td></tr>`;

function feedback(message: string, error = false): void {
  const target = document.querySelector<HTMLElement>('#admin-feedback');
  if (!target) return;
  target.textContent = message;
  target.className = `feedback ${error ? 'feedback-error' : 'feedback-ok'}`;
  target.hidden = false;
  target.scrollIntoView({ block: 'nearest' });
}

// Diálogo genérico que exige motivo. Devuelve los datos del formulario o null si se cancela.
function askForm(title: string, fields: string, options: { reason?: boolean; submit?: string } = {}): Promise<Record<string, string> | null> {
  const dialog = document.querySelector<HTMLDialogElement>('#admin-dialog')!;
  dialog.innerHTML = `<form method="dialog" class="auth-form">
    <h2>${escapar(title)}</h2>${fields}
    ${options.reason === false ? '' : '<label>Motivo <small>Obligatorio, mínimo 10 caracteres</small><textarea name="reason" required minlength="10" maxlength="500" rows="3"></textarea></label>'}
    <div class="dialog-actions"><button type="button" class="secondary-action" data-cancel>Cancelar</button><button class="primary-action" value="ok">${escapar(options.submit ?? 'Confirmar')}</button></div>
  </form>`;
  return new Promise((resolve) => {
    const form = dialog.querySelector('form')!;
    dialog.querySelector('[data-cancel]')!.addEventListener('click', () => { dialog.close(); resolve(null); });
    form.addEventListener('submit', (event) => {
      if (!form.reportValidity()) { event.preventDefault(); return; }
      resolve(Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, String(value)])));
    });
    dialog.addEventListener('cancel', () => resolve(null), { once: true });
    dialog.showModal();
  });
}

// Vuelve a dibujar la sección actual con un contenedor nuevo (sin escuchadores acumulados).
function rerender(): void {
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

async function run(action: () => Promise<unknown>, success: string, after?: () => unknown): Promise<void> {
  try { await action(); await after?.(); feedback(success); } catch (error) { feedback((error as Error).message, true); }
}

// ---------------------------------------------------------------------------------------------
// Asesores

async function advisorsSection(view: HTMLElement): Promise<void> {
  const modules = (await api<{ data: { id: string; name: string }[] }>('/admin/modules')).data;
  view.innerHTML = `
    <section class="auth-card admin-card"><div class="section-title"><div><h2>Registrar usuario</h2><p>Los asesores completan su perfil al ingresar.</p></div></div>
      <form id="create-form" class="admin-form">
        <label>Nombre completo<input name="nombreCompleto" required maxlength="150" autocomplete="name"></label>
        <label>Número de documento<input name="numeroDocumento" required maxlength="30" inputmode="numeric"></label>
        <label>Contraseña temporal<input name="password" type="password" required minlength="10" maxlength="72" autocomplete="new-password"></label>
        <label>Rol<select name="rol"><option value="asesor">Asesor</option><option value="administrador">Administrador</option></select></label>
        <button class="primary-action">Crear usuario</button>
      </form>
    </section>
    <section class="auth-card admin-card"><div class="section-title"><div><h2>Usuarios</h2><p id="total-caption">Cargando…</p></div></div>
      <form id="filter-form" class="filter-grid">
        <input name="search" type="search" placeholder="Nombre o documento" aria-label="Buscar">
        <select name="role" aria-label="Rol"><option value="">Todos los roles</option><option value="asesor">Asesor</option><option value="administrador">Administrador</option></select>
        <select name="status" aria-label="Estado"><option value="">Todos los estados</option><option value="activo">Activo</option><option value="inactivo">Inactivo</option><option value="bloqueado">Bloqueado</option></select>
        <select name="moduleId" aria-label="Módulo"><option value="">Cualquier módulo</option>${modules.map((m) => `<option value="${m.id}">${escapar(m.name)}</option>`).join('')}</select>
        <select name="progressStatus" aria-label="Estado en el módulo"><option value="">Cualquier avance</option>${['AVAILABLE', 'IN_PROGRESS', 'PASSED', 'FAILED', 'BLOCKED'].map((s) => `<option value="${s}">${text(s)}</option>`).join('')}</select>
        <label class="inline-label">Último avance desde<input name="lastActivityFrom" type="date"></label>
        <label class="inline-label">hasta<input name="lastActivityTo" type="date"></label>
        <button type="submit">Filtrar</button>
      </form>
      <div class="table-wrap"><table><thead><tr><th>Usuario</th><th>Documento</th><th>Rol</th><th>Estado</th><th>Perfil</th><th>Último acceso</th><th>Acciones</th></tr></thead><tbody id="user-rows"></tbody></table></div>
      <div class="pagination"><button id="more" type="button" hidden>Cargar más</button></div>
    </section>`;

  const rows = view.querySelector<HTMLTableSectionElement>('#user-rows')!;
  const more = view.querySelector<HTMLButtonElement>('#more')!;
  let cursor: string | null = null;
  let filters = new URLSearchParams();
  const loaded = new Map<string, Usuario>();

  async function load(reset: boolean): Promise<void> {
    if (reset) { cursor = null; rows.innerHTML = ''; loaded.clear(); }
    const query = new URLSearchParams(filters);
    query.set('limit', '20');
    if (cursor) query.set('cursor', cursor);
    const page = await api<Page<Usuario>>(`/admin/users?${query}`);
    view.querySelector('#total-caption')!.textContent = `${page.meta.total ?? page.data.length} usuario(s) con estos filtros`;
    for (const user of page.data) loaded.set(user.id, user);
    rows.insertAdjacentHTML('beforeend', page.data.map((user) => `<tr>
      <td><strong>${escapar(user.nombreCompleto)}</strong></td><td>${escapar(user.numeroDocumento)}</td><td>${escapar(user.rol)}</td>
      <td>${badge(user.estado === 'activo' ? 'ACTIVE' : user.estado === 'bloqueado' ? 'BLOCKED' : 'INACTIVE').replace(/>[^<]+</, `>${escapar(user.estado)}<`)}</td>
      <td>${user.rol === 'asesor' ? (user.debeCompletarDatos ? 'Pendiente' : 'Completo') : '—'}</td><td>${formatDate(user.ultimoAcceso)}</td>
      <td class="row-actions">
        ${user.rol === 'asesor' ? `<a class="row-action" href="#ficha/${user.id}">Ficha</a>` : ''}
        <button class="row-action" data-action="edit" data-id="${user.id}">Editar</button>
        <button class="row-action" data-action="status" data-id="${user.id}">Estado</button>
        ${user.rol === 'asesor' ? `<button class="row-action" data-action="reset" data-id="${user.id}">Contraseña</button>` : ''}
      </td></tr>`).join('') || (reset ? empty(7, 'No hay usuarios para mostrar.') : ''));
    cursor = page.meta.nextCursor;
    more.hidden = !cursor;
  }

  rows.addEventListener('click', async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
    if (!button) return;
    const user = loaded.get(button.dataset.id!)!;
    if (button.dataset.action === 'edit') {
      const data = await askForm('Editar usuario', `
        <label>Nombre completo<input name="nombreCompleto" required maxlength="150" value="${escapar(user.nombreCompleto)}"></label>
        <label>Número de documento<input name="numeroDocumento" required maxlength="30" value="${escapar(user.numeroDocumento)}"></label>
        <label>Correo<input name="correo" type="email" maxlength="150" value="${escapar(user.correo)}"></label>
        <label>Teléfono<input name="telefono" maxlength="30" value="${escapar(user.telefono)}"></label>
        <label>Rol<select name="rol"><option value="asesor" ${user.rol === 'asesor' ? 'selected' : ''}>Asesor</option><option value="administrador" ${user.rol !== 'asesor' ? 'selected' : ''}>Administrador</option></select></label>`, { reason: false, submit: 'Guardar' });
      if (!data) return;
      const body: Record<string, unknown> = { nombreCompleto: data.nombreCompleto, numeroDocumento: data.numeroDocumento, telefono: data.telefono || null };
      if (data.correo) body.correo = data.correo;
      if (data.rol !== user.rol) body.rol = data.rol;
      await run(() => api(`/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify(body) }), 'Usuario actualizado.', () => load(true));
    } else if (button.dataset.action === 'status') {
      const data = await askForm(`Cambiar estado de ${user.nombreCompleto}`, `
        <label>Nuevo estado<select name="estado">${['activo', 'inactivo', 'bloqueado'].filter((s) => s !== user.estado).map((s) => `<option value="${s}">${s}</option>`).join('')}</select></label>
        <p class="dialog-note">Desactivar o bloquear cierra de inmediato las sesiones abiertas. El historial se conserva.</p>`);
      if (!data) return;
      await run(() => api(`/admin/users/${user.id}/status`, { method: 'PATCH', body: JSON.stringify(data) }), 'Estado actualizado.', () => load(true));
    } else if (button.dataset.action === 'reset') {
      const data = await askForm(`Restablecer contraseña de ${user.nombreCompleto}`, '<p class="dialog-note">Se generará una contraseña temporal que verás una sola vez.</p>');
      if (!data) return;
      try {
        const result = await api<{ data: { temporaryPassword: string } }>(`/admin/users/${user.id}/reset-password`, { method: 'POST', body: JSON.stringify(data) });
        feedback(`Contraseña temporal: ${result.data.temporaryPassword} — compártela por un canal seguro; no se volverá a mostrar.`);
      } catch (error) { feedback((error as Error).message, true); }
    }
  });

  view.querySelector<HTMLFormElement>('#create-form')!.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    await run(() => api('/admin/users', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }), 'Usuario creado y activo.', () => { form.reset(); return load(true); });
  });
  view.querySelector<HTMLFormElement>('#filter-form')!.addEventListener('submit', (event) => {
    event.preventDefault();
    filters = new URLSearchParams([...new FormData(event.currentTarget as HTMLFormElement)].filter(([, value]) => value !== '').map(([key, value]) => [key, String(value)]));
    void load(true).catch((error) => feedback((error as Error).message, true));
  });
  more.addEventListener('click', () => void load(false).catch((error) => feedback((error as Error).message, true)));
  await load(true);
}

// ---------------------------------------------------------------------------------------------
// Ficha del asesor

type AdvisorFile = {
  user: Usuario;
  modules: { moduleId: string; name: string; status: string; progressPercent: string; blockedReason: string | null; hasSeal: boolean; lastActivityAt: string | null }[];
  catalog: { moduleId: string; name: string; activities: { activityId: string; title: string; status: string; hasEvaluation: boolean; attemptsRemaining: number | null; exhausted: boolean; waitUntil: string | null; nextAttemptNumber: number | null }[] }[];
  attempts: { id: string; number: number; status: string; score: string | null; startedAt: string; submittedAt: string | null; durationSeconds: number | null; evaluation: { version: number; activity: { title: string } } }[];
  seals: { id: string; status: string; issuedAt: string; module: { name: string } }[];
  certificates: { id: string; code: string; status: string; issuedAt: string; revokedAt: string | null; revokeReason: string | null; previousCertificateId: string | null }[];
  overrides: { id: string; action: string; extraAttempts: number; reason: string; expiresAt: string | null; revokedAt: string | null; createdAt: string; state: string; activity: { title: string; module: { name: string } }; createdBy: { nombreCompleto: string } }[];
  audit: { id: string; action: string; reason: string | null; createdAt: string; actor: { nombreCompleto: string } }[];
};

async function advisorFileSection(view: HTMLElement, userId: string): Promise<void> {
  const { data } = await api<{ data: AdvisorFile }>(`/admin/advisors/${userId}/progress`);
  const activityRows = data.catalog.flatMap((module) => module.activities.map((activity) => `<tr>
    <td>${escapar(module.name)}</td><td>${escapar(activity.title)}</td><td>${badge(activity.status)}</td>
    <td>${activity.hasEvaluation ? `${activity.attemptsRemaining ?? '—'}${activity.exhausted ? ' (agotados)' : ''}` : 'Sin evaluación'}</td>
    <td>${activity.waitUntil ? formatDate(activity.waitUntil) : '—'}</td><td>${activity.nextAttemptNumber ?? '—'}</td>
    <td><button class="row-action" data-reactivate="${activity.activityId}" data-title="${escapar(activity.title)}">Reactivar…</button></td></tr>`)).join('');
  view.innerHTML = `
    <a class="secondary-link" href="#asesores">← Volver a usuarios</a>
    <section class="auth-card admin-card"><div class="section-title"><div><h2>${escapar(data.user.nombreCompleto)}</h2>
      <p>Documento ${escapar(data.user.numeroDocumento)} · ${escapar(data.user.estado)} · ${escapar(data.user.correo ?? 'sin correo')} · creado ${formatDate(data.user.fechaCreacion)} · último acceso ${formatDate(data.user.ultimoAcceso)}</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Módulo</th><th>Estado efectivo</th><th>Progreso</th><th>Sello</th><th>Último avance</th><th>Motivo</th></tr></thead><tbody>
      ${data.modules.map((m) => `<tr><td>${escapar(m.name)}</td><td>${badge(m.status)}</td><td>${escapar(m.progressPercent)} %</td><td>${m.hasSeal ? 'Sí' : '—'}</td><td>${formatDate(m.lastActivityAt)}</td><td>${escapar(m.blockedReason ?? '')}</td></tr>`).join('')}
      </tbody></table></div></section>
    <section class="auth-card admin-card"><div class="section-title"><div><h2>Actividades</h2><p>La reactivación individual pide motivo y se registra en auditoría.</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Módulo</th><th>Actividad</th><th>Estado</th><th>Intentos restantes</th><th>Espera hasta</th><th>Próximo intento</th><th></th></tr></thead><tbody>${activityRows || empty(7)}</tbody></table></div></section>
    <section class="auth-card admin-card"><div class="section-title"><div><h2>Intentos y notas</h2></div></div>
      <div class="table-wrap"><table><thead><tr><th>#</th><th>Actividad</th><th>Versión</th><th>Estado</th><th>Nota</th><th>Inicio</th><th>Envío</th><th>Duración</th></tr></thead><tbody>
      ${data.attempts.map((a) => `<tr><td>${a.number}</td><td>${escapar(a.evaluation.activity.title)}</td><td>v${a.evaluation.version}</td><td>${badge(a.status)}</td><td>${escapar(a.score ?? '—')}</td><td>${formatDate(a.startedAt)}</td><td>${formatDate(a.submittedAt)}</td><td>${a.durationSeconds !== null ? `${Math.round(a.durationSeconds / 60)} min` : '—'}</td></tr>`).join('') || empty(8)}
      </tbody></table></div></section>
    <section class="auth-card admin-card"><div class="section-title"><div><h2>Sellos y certificados</h2></div></div>
      <div class="table-wrap"><table><thead><tr><th>Sello</th><th>Estado</th><th>Emitido</th></tr></thead><tbody>
      ${data.seals.map((s) => `<tr><td>${escapar(s.module.name)}</td><td>${badge(s.status)}</td><td>${formatDate(s.issuedAt)}</td></tr>`).join('') || empty(3)}
      </tbody></table></div>
      <div class="table-wrap"><table><thead><tr><th>Código</th><th>Estado</th><th>Emitido</th><th>Anulado</th><th>Motivo</th><th>Reemplaza a</th><th></th></tr></thead><tbody>
      ${data.certificates.map((c) => `<tr><td><strong>${escapar(c.code)}</strong></td><td>${badge(c.status)}</td><td>${formatDate(c.issuedAt)}</td><td>${formatDate(c.revokedAt)}</td><td>${escapar(c.revokeReason ?? '')}</td>
        <td>${escapar(data.certificates.find((p) => p.id === c.previousCertificateId)?.code ?? '—')}</td>
        <td>${c.status === 'ACTIVE' ? `<button class="row-action" data-cert-revoke="${c.id}">Anular</button>` : ''}${c.status !== 'REISSUED' && !data.certificates.some((n) => n.previousCertificateId === c.id) ? `<button class="row-action" data-cert-reissue="${c.id}">Reemitir</button>` : ''}</td></tr>`).join('') || empty(7, 'Sin certificados.')}
      </tbody></table></div></section>
    <section class="auth-card admin-card"><div class="section-title"><div><h2>Excepciones</h2><p>Vigentes, vencidas, consumidas y revocadas. Nunca se borran.</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Acción</th><th>Actividad</th><th>Estado</th><th>Motivo</th><th>Vence</th><th>Creada por</th><th>Fecha</th><th></th></tr></thead><tbody>
      ${data.overrides.map((o) => `<tr><td>${escapar(ACTION_TEXT[o.action] ?? o.action)}${o.extraAttempts ? ` (+${o.extraAttempts})` : ''}</td><td>${escapar(o.activity.module.name)} · ${escapar(o.activity.title)}</td><td>${badge(o.state)}</td><td>${escapar(o.reason)}</td><td>${formatDate(o.expiresAt)}</td><td>${escapar(o.createdBy.nombreCompleto)}</td><td>${formatDate(o.createdAt)}</td>
        <td>${o.state === 'VIGENTE' ? `<button class="row-action" data-revoke="${o.id}">Revocar</button>` : ''}</td></tr>`).join('') || empty(8)}
      </tbody></table></div></section>
    <section class="auth-card admin-card"><div class="section-title"><div><h2>Últimas acciones de auditoría</h2></div></div>
      <ul class="audit-list">${data.audit.map((a) => `<li><strong>${escapar(a.action)}</strong> · ${escapar(a.actor.nombreCompleto)} · ${formatDate(a.createdAt)}${a.reason ? ` — ${escapar(a.reason)}` : ''}</li>`).join('') || '<li>Sin acciones registradas.</li>'}</ul></section>`;

  const reload = rerender;
  view.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    const reactivate = target.closest<HTMLButtonElement>('[data-reactivate]');
    const revoke = target.closest<HTMLButtonElement>('[data-revoke]');
    const certRevoke = target.closest<HTMLButtonElement>('[data-cert-revoke]');
    const certReissue = target.closest<HTMLButtonElement>('[data-cert-reissue]');
    if (reactivate) {
      // Una clave por apertura del diálogo: si la solicitud se reintenta, no se duplica la excepción.
      const idempotencyKey = crypto.randomUUID();
      const form = await askForm(`Excepción para "${reactivate.dataset.title}"`, `
        <label>Acción<select name="action">${Object.entries(ACTION_TEXT).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
        <label>Intentos adicionales <small>Para intento adicional o reactivación</small><input name="extraAttempts" type="number" min="1" max="10" value="1"></label>
        <label>Vence <small>Opcional</small><input name="expiresAt" type="datetime-local"></label>`);
      if (!form) return;
      const body: Record<string, unknown> = { action: form.action, reason: form.reason };
      if (form.action === 'EXTRA_ATTEMPT' || form.action === 'REACTIVATE') body.extraAttempts = Number(form.extraAttempts || 1);
      if (form.expiresAt) body.expiresAt = new Date(form.expiresAt).toISOString();
      await run(() => api(`/admin/advisors/${userId}/activities/${reactivate.dataset.reactivate}/reactivate`, { method: 'POST', body: JSON.stringify(body), headers: { 'Idempotency-Key': idempotencyKey } }), 'Excepción registrada.', reload);
    } else if (revoke) {
      const form = await askForm('Revocar excepción', '');
      if (form) await run(() => api(`/admin/overrides/${revoke.dataset.revoke}/revoke`, { method: 'POST', body: JSON.stringify(form) }), 'Excepción revocada.', reload);
    } else if (certRevoke) {
      const form = await askForm('Anular certificado', '');
      if (form) await run(() => api(`/admin/certificates/${certRevoke.dataset.certRevoke}/revoke`, { method: 'POST', body: JSON.stringify(form) }), 'Certificado anulado.', reload);
    } else if (certReissue) {
      const form = await askForm('Reemitir certificado', '<p class="dialog-note">Se crea un certificado nuevo enlazado con el anterior.</p>');
      if (form) await run(() => api(`/admin/certificates/${certReissue.dataset.certReissue}/reissue`, { method: 'POST', body: JSON.stringify(form) }), 'Certificado reemitido.', reload);
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Módulos y actividades

type CatalogModule = { id: string; name: string; order: number; status: string; activities: { id: string; title: string; type: string; status: string; isRequired: boolean; evaluations: { version: number; minimumScore: string; maxAttempts: number; waitMinutes: number; status: string }[] }[] };

async function modulesSection(view: HTMLElement): Promise<void> {
  const { data } = await api<{ data: CatalogModule[] }>('/admin/modules');
  view.innerHTML = data.map((module) => `
    <section class="auth-card admin-card"><div class="section-title row-title"><div><h2>${String(module.order).padStart(2, '0')} · ${escapar(module.name)}</h2><p>${badge(module.status)}</p></div>
      ${module.status === 'ACTIVE' || module.status === 'INACTIVE' ? `<button class="row-action" data-module="${module.id}" data-next="${module.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'}">${module.status === 'ACTIVE' ? 'Desactivar módulo' : 'Activar módulo'}</button>` : ''}</div>
      <div class="table-wrap"><table><thead><tr><th>Actividad</th><th>Tipo</th><th>Obligatoria</th><th>Estado</th><th>Evaluación vigente</th><th>Acciones</th></tr></thead><tbody>
      ${module.activities.map((activity) => {
        const evaluation = activity.evaluations[0];
        return `<tr><td>${escapar(activity.title)}</td><td>${escapar(activity.type)}</td><td>${activity.isRequired ? 'Sí' : 'No'}</td><td>${badge(activity.status)}</td>
          <td>${evaluation ? `v${evaluation.version}: mínimo ${escapar(evaluation.minimumScore)}, ${evaluation.maxAttempts} intentos, espera ${evaluation.waitMinutes} min (${escapar(text(evaluation.status))})` : 'Sin configurar'}</td>
          <td><button class="row-action" data-activity="${activity.id}" data-next="${activity.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'}">${activity.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}</button>
          <button class="row-action" data-evaluation="${activity.id}">Configurar evaluación</button></td></tr>`;
      }).join('') || empty(6, 'El estado de este módulo depende de los sellos.')}
      </tbody></table></div></section>`).join('');

  view.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    const moduleButton = target.closest<HTMLButtonElement>('[data-module]');
    const activityButton = target.closest<HTMLButtonElement>('[data-activity]');
    const evaluationButton = target.closest<HTMLButtonElement>('[data-evaluation]');
    const reload = rerender;
    if (moduleButton || activityButton) {
      const button = (moduleButton ?? activityButton)!;
      const form = await askForm(button.dataset.next === 'INACTIVE' ? 'Desactivar globalmente' : 'Activar globalmente', '<p class="dialog-note">Desactivar impide nuevos accesos e intentos; el progreso y el historial se conservan.</p>');
      if (!form) return;
      const path = moduleButton ? `/admin/modules/${moduleButton.dataset.module}/status` : `/admin/activities/${activityButton!.dataset.activity}/status`;
      await run(() => api(path, { method: 'PATCH', body: JSON.stringify({ status: button.dataset.next, reason: form.reason }) }), 'Estado actualizado.', reload);
    } else if (evaluationButton) {
      const form = await askForm('Nueva versión de evaluación', `
        <label>Nota mínima (0–100)<input name="minimumScore" type="number" min="0" max="100" step="0.01" required value="70"></label>
        <label>Intentos máximos<input name="maxAttempts" type="number" min="1" max="20" required value="3"></label>
        <label>Espera entre intentos fallidos (minutos)<input name="waitMinutes" type="number" min="0" max="10080" required value="30"></label>
        <p class="dialog-note">Se crea una versión nueva; las anteriores se archivan y no se editan.</p>`);
      if (!form) return;
      await run(() => api(`/admin/activities/${evaluationButton.dataset.evaluation}/evaluations`, { method: 'POST', body: JSON.stringify({ minimumScore: Number(form.minimumScore), maxAttempts: Number(form.maxAttempts), waitMinutes: Number(form.waitMinutes), reason: form.reason }) }), 'Evaluación configurada.', reload);
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Métricas

type Ratio = { value: string | null; sinDatos: boolean };
const pct = (ratio: Ratio) => (ratio.sinDatos ? 'Sin datos' : `${ratio.value} %`);

async function metricsSection(view: HTMLElement, query = new URLSearchParams({ limit: '20' })): Promise<void> {
  const { data } = await api<{ data: {
    activeAdvisors: number; overallProgress: Ratio; score: { average: Ratio }; attempts: { averagePerAdvisor: Ratio; total: number };
    approvalByModule: { moduleId: string; name: string; participants: number; passed: number; approval: Ratio }[];
    distribution: { moduleId: string; status: string; advisors: number }[];
    time: { byActivity: { title: string; attempts: number; avgSeconds: string | null; medianSeconds: string | null }[] };
    stalled: { days: number; count: number; items: { nombreCompleto: string; numeroDocumento: string; lastActivityAt: string }[] };
    typing: { results: number; sinDatos: boolean; avgWpm: string | null; avgAccuracy: string | null; avgErrors: string | null; approvalRate: Ratio };
    reactivations: { total: number; byAction: { key: string; total: number }[]; byAdmin: { key: string; total: number }[]; nextAttemptPassRate: Ratio };
    location: { items: { nombreCompleto: string; numeroDocumento: string; estado: string; moduleName: string | null; moduleStatus: string | null; activityTitle: string | null; lastActivityAt: string | null }[] };
  } }>(`/admin/metrics/summary?${query}`);
  const statuses = ['AVAILABLE', 'IN_PROGRESS', 'PASSED', 'FAILED', 'BLOCKED', 'NOT_STARTED'];
  const minutes = (value: string | null) => (value === null ? '—' : `${(Number(value) / 60).toFixed(1)} min`);
  view.innerHTML = `
    <section class="auth-card admin-card"><form id="metrics-filter" class="filter-grid">
      <label class="inline-label">Desde<input type="date" name="from" value="${escapar(query.get('from'))}"></label>
      <label class="inline-label">Hasta<input type="date" name="to" value="${escapar(query.get('to'))}"></label>
      <label class="inline-label">Detenidos (días)<input type="number" name="days" min="1" max="365" value="${escapar(query.get('days') ?? '')}" placeholder="7"></label>
      <select name="advisorStatus" aria-label="Estado del asesor"><option value="">Todos los asesores</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option><option value="bloqueado">Bloqueados</option></select>
      <button type="submit">Aplicar</button></form></section>
    <div class="metric-cards">
      <div class="metric-card"><span>Asesores activos</span><strong>${data.activeAdvisors}</strong></div>
      <div class="metric-card"><span>Avance general</span><strong>${pct(data.overallProgress)}</strong></div>
      <div class="metric-card"><span>Calificación promedio</span><strong>${data.score.average.sinDatos ? 'Sin datos' : escapar(data.score.average.value)}</strong></div>
      <div class="metric-card"><span>Intentos por asesor</span><strong>${data.attempts.averagePerAdvisor.sinDatos ? 'Sin datos' : escapar(data.attempts.averagePerAdvisor.value)}</strong></div>
      <div class="metric-card"><span>Asesores detenidos (${data.stalled.days} días)</span><strong>${data.stalled.count}</strong></div>
      <div class="metric-card"><span>Reactivaciones</span><strong>${data.reactivations.total}</strong></div>
    </div>
    <section class="auth-card admin-card"><div class="section-title"><div><h2>Aprobación y distribución por módulo</h2></div></div>
      <div class="table-wrap"><table><thead><tr><th>Módulo</th><th>Participantes</th><th>Aprobados</th><th>Aprobación</th>${statuses.map((s) => `<th>${text(s)}</th>`).join('')}</tr></thead><tbody>
      ${data.approvalByModule.map((m) => `<tr><td>${escapar(m.name)}</td><td>${m.participants}</td><td>${m.passed}</td><td>${pct(m.approval)}</td>${statuses.map((s) => `<td>${data.distribution.find((d) => d.moduleId === m.moduleId && d.status === s)?.advisors ?? 0}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div></section>
    <section class="auth-card admin-card"><div class="section-title"><div><h2>Ubicación actual de cada asesor</h2></div></div>
      <div class="table-wrap"><table><thead><tr><th>Asesor</th><th>Documento</th><th>Estado</th><th>Módulo actual</th><th>Avance</th><th>Actividad</th><th>Último avance</th></tr></thead><tbody>
      ${data.location.items.map((l) => `<tr><td>${escapar(l.nombreCompleto)}</td><td>${escapar(l.numeroDocumento)}</td><td>${escapar(l.estado)}</td><td>${escapar(l.moduleName ?? 'Ruta completada')}</td><td>${l.moduleStatus ? badge(l.moduleStatus) : '—'}</td><td>${escapar(l.activityTitle ?? '—')}</td><td>${formatDate(l.lastActivityAt)}</td></tr>`).join('') || empty(7)}
      </tbody></table></div></section>
    <section class="auth-card admin-card"><div class="section-title"><div><h2>Asesores detenidos</h2><p>Sin avance en los últimos ${data.stalled.days} días.</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Asesor</th><th>Documento</th><th>Último avance</th></tr></thead><tbody>
      ${data.stalled.items.map((s) => `<tr><td>${escapar(s.nombreCompleto)}</td><td>${escapar(s.numeroDocumento)}</td><td>${formatDate(s.lastActivityAt)}</td></tr>`).join('') || empty(3)}
      </tbody></table></div></section>
    <section class="auth-card admin-card"><div class="section-title"><div><h2>Tiempo empleado por actividad</h2></div></div>
      <div class="table-wrap"><table><thead><tr><th>Actividad</th><th>Intentos</th><th>Promedio</th><th>Mediana</th></tr></thead><tbody>
      ${data.time.byActivity.map((t) => `<tr><td>${escapar(t.title)}</td><td>${t.attempts}</td><td>${minutes(t.avgSeconds)}</td><td>${minutes(t.medianSeconds)}</td></tr>`).join('') || empty(4, 'Sin datos.')}
      </tbody></table></div></section>
    <div class="metric-cards">
      <div class="metric-card"><span>Mecanografía: PPM promedio</span><strong>${data.typing.sinDatos ? 'Sin datos' : escapar(data.typing.avgWpm)}</strong></div>
      <div class="metric-card"><span>Precisión promedio</span><strong>${data.typing.sinDatos ? 'Sin datos' : `${escapar(data.typing.avgAccuracy)} %`}</strong></div>
      <div class="metric-card"><span>Errores promedio</span><strong>${data.typing.sinDatos ? 'Sin datos' : escapar(data.typing.avgErrors)}</strong></div>
      <div class="metric-card"><span>Aprobación tras reactivar</span><strong>${pct(data.reactivations.nextAttemptPassRate)}</strong></div>
    </div>
    <section class="auth-card admin-card"><div class="section-title"><div><h2>Reactivaciones</h2></div></div>
      <div class="split-lists"><ul class="audit-list">${data.reactivations.byAction.map((r) => `<li>${escapar(ACTION_TEXT[r.key] ?? r.key)}: <strong>${r.total}</strong></li>`).join('') || '<li>Sin datos.</li>'}</ul>
      <ul class="audit-list">${data.reactivations.byAdmin.map((r) => `<li>${escapar(r.key)}: <strong>${r.total}</strong></li>`).join('') || '<li>Sin datos.</li>'}</ul></div></section>`;
  const select = view.querySelector<HTMLSelectElement>('[name="advisorStatus"]')!;
  select.value = query.get('advisorStatus') ?? '';
  view.querySelector<HTMLFormElement>('#metrics-filter')!.addEventListener('submit', (event) => {
    event.preventDefault();
    const next = new URLSearchParams([...new FormData(event.currentTarget as HTMLFormElement)].filter(([, value]) => value !== '').map(([key, value]) => [key, String(value)]));
    next.set('limit', '20');
    void metricsSection(view, next).catch((error) => feedback((error as Error).message, true));
  });
}

// ---------------------------------------------------------------------------------------------
// Auditoría (solo lectura)

async function auditSection(view: HTMLElement): Promise<void> {
  view.innerHTML = `<section class="auth-card admin-card"><div class="section-title"><div><h2>Auditoría</h2><p>Registro de solo lectura de las acciones administrativas.</p></div></div>
    <form id="audit-filter" class="filter-grid">
      <input name="action" placeholder="Acción (ej. USER_STATUS_CHANGED)" aria-label="Acción">
      <input name="entityType" placeholder="Entidad (ej. Usuario)" aria-label="Entidad">
      <input name="entityId" placeholder="Id de la entidad" aria-label="Id">
      <label class="inline-label">Desde<input type="date" name="from"></label><label class="inline-label">Hasta<input type="date" name="to"></label>
      <button type="submit">Filtrar</button></form>
    <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Actor</th><th>Acción</th><th>Entidad</th><th>Motivo</th></tr></thead><tbody id="audit-rows"></tbody></table></div>
    <div class="pagination"><button id="audit-more" type="button" hidden>Cargar más</button></div></section>`;
  const rows = view.querySelector('#audit-rows')!;
  const more = view.querySelector<HTMLButtonElement>('#audit-more')!;
  let cursor: string | null = null;
  let filters = new URLSearchParams();
  async function load(reset: boolean): Promise<void> {
    if (reset) { cursor = null; rows.innerHTML = ''; }
    const query = new URLSearchParams(filters);
    query.set('limit', '30');
    if (cursor) query.set('cursor', cursor);
    const page = await api<Page<{ createdAt: string; action: string; entityType: string; entityId: string; reason: string | null; actor: { nombreCompleto: string } }>>(`/admin/audit?${query}`);
    rows.insertAdjacentHTML('beforeend', page.data.map((a) => `<tr><td>${formatDate(a.createdAt)}</td><td>${escapar(a.actor.nombreCompleto)}</td><td>${escapar(a.action)}</td><td>${escapar(a.entityType)} <small>${escapar(a.entityId.slice(0, 8))}</small></td><td>${escapar(a.reason ?? '')}</td></tr>`).join('') || (reset ? empty(5) : ''));
    cursor = page.meta.nextCursor;
    more.hidden = !cursor;
  }
  view.querySelector<HTMLFormElement>('#audit-filter')!.addEventListener('submit', (event) => {
    event.preventDefault();
    filters = new URLSearchParams([...new FormData(event.currentTarget as HTMLFormElement)].filter(([, value]) => value !== '').map(([key, value]) => [key, String(value)]));
    void load(true).catch((error) => feedback((error as Error).message, true));
  });
  more.addEventListener('click', () => void load(false).catch((error) => feedback((error as Error).message, true)));
  await load(true);
}

// ---------------------------------------------------------------------------------------------

const SECTIONS = [
  { hash: '#asesores', label: 'Asesores' },
  { hash: '#modulos', label: 'Módulos y actividades' },
  { hash: '#metricas', label: 'Métricas' },
  { hash: '#auditoria', label: 'Auditoría' },
];

export function renderAdmin(shell: Shell): void {
  shell('Panel de administración', 'Gestiona asesores, la ruta de formación y su seguimiento.', `
    <div class="admin-layout"><aside class="admin-nav"><strong>Administración</strong>
      ${SECTIONS.map((section) => `<a href="${section.hash}" data-nav="${section.hash}">${section.label}</a>`).join('')}
      <p>Toda acción que modifica datos pide un motivo y queda en auditoría.</p></aside>
    <div class="admin-content"><p id="admin-feedback" class="feedback" role="status" hidden></p><div id="admin-view"></div></div></div>
    <dialog id="admin-dialog" class="edit-dialog"></dialog>`);

  async function route(): Promise<void> {
    const hash = location.hash || '#asesores';
    document.querySelectorAll<HTMLAnchorElement>('[data-nav]').forEach((link) => link.classList.toggle('selected', hash.startsWith(link.dataset.nav!) || (hash.startsWith('#ficha') && link.dataset.nav === '#asesores')));
    const old = document.querySelector<HTMLElement>('#admin-view')!;
    const view = old.cloneNode(false) as HTMLElement; // descarta escuchadores de la sección anterior
    old.replaceWith(view);
    view.innerHTML = '<p class="loading-note">Cargando…</p>';
    document.querySelector<HTMLElement>('#admin-feedback')!.hidden = true;
    try {
      if (hash.startsWith('#ficha/')) await advisorFileSection(view, hash.slice('#ficha/'.length));
      else if (hash === '#modulos') await modulesSection(view);
      else if (hash === '#metricas') await metricsSection(view);
      else if (hash === '#auditoria') await auditSection(view);
      else await advisorsSection(view);
    } catch (error) {
      view.innerHTML = '';
      feedback((error as Error).message, true);
    }
  }
  window.addEventListener('hashchange', () => void route());
  void route();
}
