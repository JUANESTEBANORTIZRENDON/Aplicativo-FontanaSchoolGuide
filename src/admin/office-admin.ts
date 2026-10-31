import { api, escapar, formatDate } from '../http';

// Sección "Ofimática" del panel: configuración versionada, contenido (textos, Excel, dictados, reglas),
// medios y la ficha del asesor en el módulo. Toda escritura pide motivo y queda en auditoría.

export type AdminHelpers = {
  askForm: (title: string, fields: string, options?: { reason?: boolean; submit?: string }) => Promise<Record<string, string> | null>;
  run: (action: () => Promise<unknown>, success: string, after?: () => unknown) => Promise<void>;
  feedback: (message: string, error?: boolean) => void;
  rerender: () => Promise<void>;
  badge: (value: string) => string;
  empty: (columns: number, message?: string) => string;
};

type ConfigValues = {
  typingDurationSeconds: number; typingMinCorrectCpm: number; typingMinAccuracy: number; typingMaxAttempts: number; typingStartWindowSeconds: number;
  typingAttemptTtlMinutes: number; excelMinScore: number; excelMaxAttempts: number; dictationMinScore: number; dictationMaxAttempts: number; dictationMaxPlays: number;
};
type ConfigPayload = {
  config: ConfigValues & { version: number };
  history: { id: string; version: number; status: string; reason: string | null; createdAt: string; createdBy: { nombreCompleto: string } | null; values: ConfigValues }[];
};

const CONFIG_FIELDS: { key: keyof ConfigValues; label: string; hint: string; step?: string }[] = [
  { key: 'typingDurationSeconds', label: 'Duración de la prueba (s)', hint: 'Segundos de escritura' },
  { key: 'typingMinCorrectCpm', label: 'Caracteres correctos por minuto', hint: '150 equivalen a 30 PPM' },
  { key: 'typingMinAccuracy', label: 'Precisión mínima (%)', hint: 'De 1 a 100', step: '0.01' },
  { key: 'typingMaxAttempts', label: 'Intentos de mecanografía', hint: 'Máximo por asesor' },
  { key: 'typingStartWindowSeconds', label: 'Ventana de arranque (s)', hint: 'Tiempo máximo para la primera tecla' },
  { key: 'typingAttemptTtlMinutes', label: 'Vigencia de un intento preparado (min)', hint: 'Después vence' },
  { key: 'dictationMinScore', label: 'Nota mínima del dictado', hint: 'De 1 a 100', step: '0.01' },
  { key: 'dictationMaxAttempts', label: 'Intentos del dictado', hint: 'Máximo por asesor' },
  { key: 'dictationMaxPlays', label: 'Reproducciones por intento', hint: 'Veces que puede oír el audio' },
];

async function upload(key: string, file: File, reason: string): Promise<void> {
  const response = await fetch(`/api/admin/training/office/media/${encodeURIComponent(key)}?reason=${encodeURIComponent(reason)}`, {
    method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(body?.message ?? 'No se pudo cargar el archivo.');
  }
}

const TABS = [
  { id: 'config', label: 'Configuración' },
  { id: 'texts', label: 'Textos de mecanografía' },
  { id: 'excel', label: 'Escenarios de Excel' },
  { id: 'dictations', label: 'Dictados' },
  { id: 'rules', label: 'Reglas de ortografía' },
  { id: 'media', label: 'Medios' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export async function officeSection(view: HTMLElement, helpers: AdminHelpers): Promise<void> {
  let tab: TabId = (sessionStorage.getItem('office-admin-tab') as TabId | null) ?? 'config';
  if (!TABS.some((item) => item.id === tab)) tab = 'config';
  view.innerHTML = `
    <section class="auth-card admin-card"><div class="section-title"><div><h2>Ofimática para tus cobranzas</h2>
      <p>Configura los umbrales sin volver a desplegar la aplicación. Cada cambio crea una versión nueva y queda auditado.</p></div></div>
      <div class="office-admin-tabs" role="tablist">${TABS.map((item) => `<button type="button" role="tab" class="row-action" data-tab="${item.id}" aria-selected="${item.id === tab}">${item.label}</button>`).join('')}</div>
    </section>
    <div id="office-admin-body"></div>`;
  async function draw(): Promise<void> {
    view.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach((button) => button.setAttribute('aria-selected', String(button.dataset.tab === tab)));
    const previous = view.querySelector<HTMLElement>('#office-admin-body')!;
    const body = previous.cloneNode(false) as HTMLElement;
    previous.replaceWith(body);
    body.innerHTML = '<p class="loading-note">Cargando…</p>';
    try {
      if (tab === 'config') await drawConfig(body, helpers, draw);
      else if (tab === 'texts') await drawTexts(body, helpers, draw);
      else if (tab === 'excel') await drawExcel(body, helpers, draw);
      else if (tab === 'dictations') await drawDictations(body, helpers, draw);
      else if (tab === 'rules') await drawRules(body, helpers, draw);
      else await drawMedia(body, helpers, draw);
    } catch (error) {
      body.innerHTML = '';
      helpers.feedback((error as Error).message, true);
    }
  }
  view.querySelector('.office-admin-tabs')!.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-tab]');
    if (!button) return;
    tab = button.dataset.tab as TabId;
    try { sessionStorage.setItem('office-admin-tab', tab); } catch { /* sin almacenamiento */ }
    void draw();
  });
  await draw();
}

// ---------------------------------------------------------------------------------------------

async function drawConfig(body: HTMLElement, helpers: AdminHelpers, redraw: () => Promise<void>): Promise<void> {
  const { data } = await api<{ data: ConfigPayload }>('/admin/training/office/config');
  const current = data.config;
  body.innerHTML = `
    <section class="auth-card admin-card"><div class="section-title"><div><h2>Versión vigente: v${current.version}</h2>
      <p>Solo se envían los valores que cambies. El motivo es obligatorio.</p><p>Excel práctico: siete ejercicios (100 puntos repartidos), aprobación con 80 puntos y reintentos sin límite. Los valores de Excel del historial corresponden a la configuración anterior.</p></div></div>
      <form id="office-config" class="admin-form">
        ${CONFIG_FIELDS.map((field) => `<label>${escapar(field.label)} <small>${escapar(field.hint)}</small><input name="${field.key}" type="number" step="${field.step ?? '1'}" required value="${current[field.key]}"></label>`).join('')}
        <label>Motivo del cambio <small>Obligatorio</small><textarea name="reason" required minlength="5" maxlength="500" rows="2"></textarea></label>
        <button class="primary-action">Crear nueva versión</button>
      </form></section>
    <section class="auth-card admin-card"><div class="section-title"><div><h2>Historial de versiones</h2></div></div>
      <div class="table-wrap"><table><thead><tr><th>Versión</th><th>Estado</th><th>Fecha</th><th>Quién</th><th>Motivo</th><th>Mecanografía</th><th>Excel</th><th>Dictado</th></tr></thead><tbody>
      ${data.history.map((row) => `<tr><td>v${row.version}</td><td>${helpers.badge(row.status)}</td><td>${formatDate(row.createdAt)}</td><td>${escapar(row.createdBy?.nombreCompleto ?? 'Sistema')}</td><td>${escapar(row.reason ?? '')}</td>
        <td>${row.values.typingMinCorrectCpm} car./min · ${row.values.typingMinAccuracy} % · ${row.values.typingMaxAttempts} int.</td>
        <td>${row.values.excelMinScore} pts · ${row.values.excelMaxAttempts} int.</td>
        <td>${row.values.dictationMinScore} pts · ${row.values.dictationMaxAttempts} int. · ${row.values.dictationMaxPlays} reprod.</td></tr>`).join('') || helpers.empty(8)}
      </tbody></table></div></section>`;
  body.querySelector<HTMLFormElement>('#office-config')!.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const payload: Record<string, unknown> = { reason: (form.elements.namedItem('reason') as HTMLTextAreaElement).value.trim() };
    for (const field of CONFIG_FIELDS) {
      const value = Number((form.elements.namedItem(field.key) as HTMLInputElement).value);
      if (value !== current[field.key]) payload[field.key] = value;
    }
    if (Object.keys(payload).length === 1) { helpers.feedback('No cambiaste ningún valor.', true); return; }
    await helpers.run(() => api('/admin/training/office/config', { method: 'PATCH', body: JSON.stringify(payload) }), 'Nueva versión de la configuración creada.', redraw);
  });
}

// ---------------------------------------------------------------------------------------------

type TextRow = { id: string; key: string; version: number; title: string; content: string; status: string; usage: number; length: number };

async function drawTexts(body: HTMLElement, helpers: AdminHelpers, redraw: () => Promise<void>): Promise<void> {
  const { data } = await api<{ data: TextRow[] }>('/admin/training/office/texts');
  body.innerHTML = `
    <section class="auth-card admin-card"><div class="section-title"><div><h2>Textos de mecanografía</h2><p>De 650 a 900 caracteres, ficticios. Un texto ya usado se versiona al editarlo; nunca se borra.</p></div>
      <button class="primary-action" id="text-new" type="button">Nuevo texto</button></div>
      <div class="table-wrap"><table><thead><tr><th>Clave</th><th>Título</th><th>Versión</th><th>Estado</th><th>Caracteres</th><th>Usos</th><th></th></tr></thead><tbody>
      ${data.map((row) => `<tr><td>${escapar(row.key)}</td><td>${escapar(row.title)}</td><td>v${row.version}</td><td>${helpers.badge(row.status)}</td><td>${row.length}</td><td>${row.usage}</td>
        <td class="row-actions"><button class="row-action" data-edit="${row.id}">Editar</button>
        ${row.status === 'ACTIVE' ? `<button class="row-action" data-status="${row.id}" data-to="INACTIVE">Desactivar</button>` : row.status !== 'ARCHIVED' ? `<button class="row-action" data-status="${row.id}" data-to="ACTIVE">Activar</button>` : ''}</td></tr>`).join('') || helpers.empty(7)}
      </tbody></table></div></section>`;
  const byId = new Map(data.map((row) => [row.id, row]));
  body.querySelector('#text-new')!.addEventListener('click', async () => {
    const form = await helpers.askForm('Nuevo texto de mecanografía', `
      <label>Clave <small>minúsculas, números y guiones</small><input name="key" required pattern="[a-z0-9\\-]{3,60}"></label>
      <label>Título<input name="title" required maxlength="150"></label>
      <label>Texto <small>650 a 900 caracteres</small><textarea name="content" required minlength="650" maxlength="900" rows="8"></textarea></label>`);
    if (form) await helpers.run(() => api('/admin/training/office/texts', { method: 'POST', body: JSON.stringify({ key: form.key, title: form.title, content: form.content, status: 'DRAFT', reason: form.reason }) }), 'Texto creado en borrador.', redraw);
  });
  body.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    const edit = target.closest<HTMLButtonElement>('[data-edit]');
    const status = target.closest<HTMLButtonElement>('[data-status]');
    if (edit) {
      const row = byId.get(edit.dataset.edit!)!;
      const form = await helpers.askForm(`Editar «${row.title}»`, `
        <label>Título<input name="title" required maxlength="150" value="${escapar(row.title)}"></label>
        <label>Texto <small>${row.usage ? 'Ya se usó: se creará la versión siguiente.' : '650 a 900 caracteres'}</small><textarea name="content" required minlength="650" maxlength="900" rows="8">${escapar(row.content)}</textarea></label>`);
      if (form) await helpers.run(() => api(`/admin/training/office/texts/${row.id}`, { method: 'PATCH', body: JSON.stringify({ title: form.title, content: form.content, reason: form.reason }) }), 'Texto actualizado.', redraw);
    } else if (status) {
      const form = await helpers.askForm(status.dataset.to === 'ACTIVE' ? 'Activar texto' : 'Desactivar texto', '');
      if (form) await helpers.run(() => api(`/admin/training/office/texts/${status.dataset.status}`, { method: 'PATCH', body: JSON.stringify({ status: status.dataset.to, reason: form.reason }) }), 'Estado actualizado.', redraw);
    }
  });
}

// ---------------------------------------------------------------------------------------------

type ExcelRow = { id: string; key: string; version: number; title: string; status: string; usage: number; scenarioData: unknown; answerKey: unknown };

async function drawExcel(body: HTMLElement, helpers: AdminHelpers, redraw: () => Promise<void>): Promise<void> {
  const { data } = await api<{ data: ExcelRow[] }>('/admin/training/office/excel-activities');
  body.innerHTML = `
    <section class="auth-card admin-card"><div class="section-title"><div><h2>Escenarios de Excel</h2><p>Datos ficticios. La clave de respuestas nunca se envía al navegador del asesor.</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Clave</th><th>Título</th><th>Versión</th><th>Estado</th><th>Usos</th><th></th></tr></thead><tbody>
      ${data.map((row) => `<tr><td>${escapar(row.key)}</td><td>${escapar(row.title)}</td><td>v${row.version}</td><td>${helpers.badge(row.status)}</td><td>${row.usage}</td>
        <td class="row-actions"><button class="row-action" data-edit="${row.id}">Editar…</button>
        ${row.status === 'ACTIVE' ? `<button class="row-action" data-status="${row.id}" data-to="INACTIVE">Desactivar</button>` : row.status !== 'ARCHIVED' ? `<button class="row-action" data-status="${row.id}" data-to="ACTIVE">Activar</button>` : ''}</td></tr>`).join('') || helpers.empty(6)}
      </tbody></table></div></section>`;
  const byId = new Map(data.map((row) => [row.id, row]));
  body.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    const edit = target.closest<HTMLButtonElement>('[data-edit]');
    const status = target.closest<HTMLButtonElement>('[data-status]');
    if (edit) {
      const row = byId.get(edit.dataset.edit!)!;
      const form = await helpers.askForm(`Editar «${row.title}»`, `
        <label>Título<input name="title" required maxlength="150" value="${escapar(row.title)}"></label>
        <label>Datos del escenario (JSON)<textarea name="scenarioData" required rows="8">${escapar(JSON.stringify(row.scenarioData, null, 2))}</textarea></label>
        <label>Clave de respuestas (JSON, pesos que sumen 100)<textarea name="answerKey" required rows="8">${escapar(JSON.stringify(row.answerKey, null, 2))}</textarea></label>`);
      if (!form) return;
      let scenarioData: unknown;
      let answerKey: unknown;
      try { scenarioData = JSON.parse(form.scenarioData!); answerKey = JSON.parse(form.answerKey!); } catch { helpers.feedback('Los datos del escenario o la clave no son JSON válido.', true); return; }
      await helpers.run(() => api(`/admin/training/office/excel-activities/${row.id}`, { method: 'PATCH', body: JSON.stringify({ title: form.title, scenarioData, answerKey, reason: form.reason }) }), 'Escenario actualizado.', redraw);
    } else if (status) {
      const form = await helpers.askForm(status.dataset.to === 'ACTIVE' ? 'Activar escenario' : 'Desactivar escenario', '');
      if (form) await helpers.run(() => api(`/admin/training/office/excel-activities/${status.dataset.status}`, { method: 'PATCH', body: JSON.stringify({ status: status.dataset.to, reason: form.reason }) }), 'Estado actualizado.', redraw);
    }
  });
}

// ---------------------------------------------------------------------------------------------

type DictationRow = { id: string; key: string; version: number; title: string; status: string; expectedText: string; audioKey: string | null; audioDurationSeconds: number | null; audioUploaded: boolean; usage: number; difficulty: number };

async function drawDictations(body: HTMLElement, helpers: AdminHelpers, redraw: () => Promise<void>): Promise<void> {
  const { data } = await api<{ data: DictationRow[] }>('/admin/training/office/dictations');
  body.innerHTML = `
    <section class="auth-card admin-card"><div class="section-title"><div><h2>Ejercicios de dictado</h2><p>No se activan sin audio autorizado: sube el audio (OGG o MP3, hasta 2 MB, de 20 a 30 segundos) y luego actívalos.</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Clave</th><th>Título</th><th>Versión</th><th>Estado</th><th>Audio</th><th>Usos</th><th></th></tr></thead><tbody>
      ${data.map((row) => `<tr><td>${escapar(row.key)}</td><td>${escapar(row.title)}</td><td>v${row.version}</td><td>${helpers.badge(row.status)}</td>
        <td>${row.audioKey ? `${escapar(row.audioKey)} ${row.audioUploaded ? '✓' : '(sin cargar)'}` : 'Sin audio'}</td><td>${row.usage}</td>
        <td class="row-actions"><button class="row-action" data-audio="${row.id}">Subir audio…</button><button class="row-action" data-edit="${row.id}">Editar</button>
        ${row.status === 'ACTIVE' ? `<button class="row-action" data-status="${row.id}" data-to="INACTIVE">Desactivar</button>` : row.status !== 'ARCHIVED' ? `<button class="row-action" data-status="${row.id}" data-to="ACTIVE">Activar</button>` : ''}</td></tr>`).join('') || helpers.empty(7)}
      </tbody></table></div></section>`;
  const byId = new Map(data.map((row) => [row.id, row]));
  body.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    const audio = target.closest<HTMLButtonElement>('[data-audio]');
    const edit = target.closest<HTMLButtonElement>('[data-edit]');
    const status = target.closest<HTMLButtonElement>('[data-status]');
    if (audio) {
      const row = byId.get(audio.dataset.audio!)!;
      const form = await helpers.askForm(`Audio de «${row.title}»`, `
        <label>Archivo de audio <small>OGG o MP3, hasta 2 MB</small><input name="file" type="file" accept=".ogg,.mp3,audio/ogg,audio/mpeg" required></label>
        <label>Duración (segundos) <small>De 20 a 120</small><input name="duration" type="number" min="20" max="120" required value="${row.audioDurationSeconds ?? 25}"></label>`);
      if (!form) return;
      const input = document.querySelector<HTMLInputElement>('#admin-dialog input[type="file"]');
      const file = input?.files?.[0];
      if (!file) { helpers.feedback('Selecciona un archivo de audio.', true); return; }
      const extension = file.name.toLowerCase().endsWith('.mp3') ? 'mp3' : 'ogg';
      const key = `dictado-${row.key}.${extension}`;
      await helpers.run(async () => {
        await upload(key, file, form.reason!);
        await api(`/admin/training/office/dictations/${row.id}`, { method: 'PATCH', body: JSON.stringify({ audioKey: key, audioDurationSeconds: Number(form.duration), reason: form.reason }) });
      }, 'Audio cargado y asociado al ejercicio.', redraw);
    } else if (edit) {
      const row = byId.get(edit.dataset.edit!)!;
      const form = await helpers.askForm(`Editar «${row.title}»`, `
        <label>Título<input name="title" required maxlength="150" value="${escapar(row.title)}"></label>
        <label>Texto esperado <small>${row.usage ? 'Ya se usó: si lo cambias se creará la versión siguiente.' : 'Lo que dice el audio'}</small><textarea name="expectedText" required minlength="20" maxlength="800" rows="5">${escapar(row.expectedText)}</textarea></label>
        <label>Dificultad<select name="difficulty">${[1, 2, 3].map((n) => `<option value="${n}" ${n === row.difficulty ? 'selected' : ''}>${n}</option>`).join('')}</select></label>`);
      if (form) await helpers.run(() => api(`/admin/training/office/dictations/${row.id}`, { method: 'PATCH', body: JSON.stringify({ title: form.title, expectedText: form.expectedText, difficulty: Number(form.difficulty), reason: form.reason }) }), 'Ejercicio actualizado.', redraw);
    } else if (status) {
      const form = await helpers.askForm(status.dataset.to === 'ACTIVE' ? 'Activar ejercicio' : 'Desactivar ejercicio', '');
      if (form) await helpers.run(() => api(`/admin/training/office/dictations/${status.dataset.status}`, { method: 'PATCH', body: JSON.stringify({ status: status.dataset.to, reason: form.reason }) }), 'Estado actualizado.', redraw);
    }
  });
}

// ---------------------------------------------------------------------------------------------

type RuleRow = { id: string; key: string; version: number; category: string; severity: string; weight: string; pairs: [string, string][]; explanation: string; status: string };

async function drawRules(body: HTMLElement, helpers: AdminHelpers, redraw: () => Promise<void>): Promise<void> {
  const { data } = await api<{ data: RuleRow[] }>('/admin/training/office/rules');
  body.innerHTML = `
    <section class="auth-card admin-card"><div class="section-title"><div><h2>Reglas de ortografía</h2><p>Las usa el sistema experto (determinístico). Ollama no califica.</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Regla</th><th>Categoría</th><th>Severidad</th><th>Peso</th><th>Pares</th><th>Versión</th><th>Estado</th><th></th></tr></thead><tbody>
      ${data.map((row) => `<tr><td>${escapar(row.key)}<br><small>${escapar(row.explanation)}</small></td><td>${escapar(row.category)}</td><td>${row.severity === 'CRITICAL' ? 'Crítica' : 'Menor'}</td><td>${escapar(row.weight)}</td>
        <td>${escapar(row.pairs.map((pair) => pair.join(' / ')).join('; ') || '—')}</td><td>v${row.version}</td><td>${helpers.badge(row.status)}</td>
        <td class="row-actions"><button class="row-action" data-edit="${row.id}">Editar</button>
        ${row.status === 'ACTIVE' ? `<button class="row-action" data-status="${row.id}" data-to="INACTIVE">Desactivar</button>` : row.status !== 'ARCHIVED' ? `<button class="row-action" data-status="${row.id}" data-to="ACTIVE">Activar</button>` : ''}</td></tr>`).join('') || helpers.empty(8)}
      </tbody></table></div></section>`;
  const byId = new Map(data.map((row) => [row.id, row]));
  body.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    const edit = target.closest<HTMLButtonElement>('[data-edit]');
    const status = target.closest<HTMLButtonElement>('[data-status]');
    if (edit) {
      const row = byId.get(edit.dataset.edit!)!;
      const form = await helpers.askForm(`Editar la regla ${row.key}`, `
        <label>Severidad<select name="severity"><option value="CRITICAL" ${row.severity === 'CRITICAL' ? 'selected' : ''}>Crítica (impide aprobar)</option><option value="MINOR" ${row.severity === 'MINOR' ? 'selected' : ''}>Menor</option></select></label>
        <label>Peso <small>Puntos que resta</small><input name="weight" type="number" min="0" max="50" step="0.5" required value="${escapar(row.weight)}"></label>
        <label>Explicación<textarea name="explanation" required minlength="10" maxlength="400" rows="3">${escapar(row.explanation)}</textarea></label>
        <label>Pares (uno por línea: esperado / confusión)<textarea name="pairs" rows="4">${escapar(row.pairs.map((pair) => pair.join(' / ')).join('\n'))}</textarea></label>`);
      if (!form) return;
      const pairs = form.pairs!.split('\n').map((line) => line.split('/').map((part) => part.trim())).filter((parts) => parts.length === 2 && parts[0] && parts[1]);
      await helpers.run(() => api(`/admin/training/office/rules/${row.id}`, {
        method: 'PATCH', body: JSON.stringify({ severity: form.severity, weight: Number(form.weight), explanation: form.explanation, pairs, reason: form.reason }),
      }), 'Regla actualizada.', redraw);
    } else if (status) {
      const form = await helpers.askForm(status.dataset.to === 'ACTIVE' ? 'Activar regla' : 'Desactivar regla', '');
      if (form) await helpers.run(() => api(`/admin/training/office/rules/${status.dataset.status}`, { method: 'PATCH', body: JSON.stringify({ status: status.dataset.to, reason: form.reason }) }), 'Estado actualizado.', redraw);
    }
  });
}

// ---------------------------------------------------------------------------------------------

type MediaPayload = { images: { key: string; exists: boolean; size: number | null; alt: string }[]; audios: { key: string; exists: boolean; size: number | null }[] };

async function drawMedia(body: HTMLElement, helpers: AdminHelpers, redraw: () => Promise<void>): Promise<void> {
  const { data } = await api<{ data: MediaPayload }>('/admin/training/office/media');
  body.innerHTML = `
    <section class="auth-card admin-card"><div class="section-title"><div><h2>Imágenes del módulo</h2><p>Las 6 ilustraciones se generan una vez fuera de la aplicación (ver docs-assets/ofimatica/IMAGENES.md) y se suben aquí en WebP de hasta 1 MB. Mientras falten, el asesor ve un marcador con el texto alternativo.</p></div></div>
      <div class="table-wrap"><table><thead><tr><th>Archivo</th><th>Texto alternativo</th><th>Estado</th><th></th></tr></thead><tbody>
      ${data.images.map((image) => `<tr><td>${escapar(image.key)}</td><td>${escapar(image.alt)}</td><td>${image.exists ? `Cargada (${Math.round((image.size ?? 0) / 1024)} KB)` : 'Pendiente'}</td>
        <td><button class="row-action" data-upload="${escapar(image.key)}">${image.exists ? 'Reemplazar…' : 'Subir…'}</button></td></tr>`).join('')}
      </tbody></table></div></section>
    <section class="auth-card admin-card"><div class="section-title"><div><h2>Audios de los dictados</h2></div></div>
      <div class="table-wrap"><table><thead><tr><th>Archivo</th><th>Estado</th></tr></thead><tbody>
      ${data.audios.map((audio) => `<tr><td>${escapar(audio.key)}</td><td>${audio.exists ? `Cargado (${Math.round((audio.size ?? 0) / 1024)} KB)` : 'Pendiente'}</td></tr>`).join('') || helpers.empty(2, 'Aún no hay audios asociados. Súbelos desde «Dictados».')}
      </tbody></table></div></section>`;
  body.addEventListener('click', async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-upload]');
    if (!button) return;
    const form = await helpers.askForm(`Subir ${button.dataset.upload}`, '<label>Imagen WebP <small>Hasta 1 MB</small><input name="file" type="file" accept=".webp,image/webp" required></label>');
    if (!form) return;
    const file = document.querySelector<HTMLInputElement>('#admin-dialog input[type="file"]')?.files?.[0];
    if (!file) { helpers.feedback('Selecciona un archivo.', true); return; }
    await helpers.run(() => upload(button.dataset.upload!, file, form.reason!), 'Imagen cargada.', redraw);
  });
}

// ---------------------------------------------------------------------------------------------
// Ficha del asesor

type OfficeFile = {
  lastActivityAt: string | null;
  typing: { number: number; status: string; startedAt: string; text: { title: string }; correctCpm: number; ppm: string; accuracy: string; errorCount: number; passed: boolean | null; closeReason: string | null; suspicious: boolean; configVersion: number | null }[];
  excel: { number: number; status: string; completedAt: string | null; score: string | null; passed: boolean | null; steps: { questionId: string; correct: boolean }[] | null }[];
  dictation: { number: number; status: string; completedAt: string | null; exercise: { title: string }; score: string | null; passed: boolean | null; criticalCount: number | null; errors: { expected: string; written: string; severity: string; explanation: string }[] | null; recommendation: { resumen: string } | null; recommendationSource: string | null }[];
};

export function officeFileHtml(office: OfficeFile | undefined, helpers: Pick<AdminHelpers, 'badge' | 'empty'>): string {
  if (!office) return '';
  const result = (value: boolean | null) => (value === null ? '—' : value ? 'Aprobado' : 'No aprobado');
  return `
    <section class="auth-card admin-card"><div class="section-title"><div><h2>Ofimática para tus cobranzas</h2><p>Último movimiento: ${formatDate(office.lastActivityAt)}</p></div></div>
      <h3>Mecanografía</h3>
      <div class="table-wrap"><table><thead><tr><th>#</th><th>Texto</th><th>Inicio</th><th>Car./min</th><th>PPM</th><th>Precisión</th><th>Errores</th><th>Resultado</th><th>Cierre</th><th>Config.</th></tr></thead><tbody>
      ${office.typing.map((row) => `<tr><td>${row.number}</td><td>${escapar(row.text.title)}</td><td>${formatDate(row.startedAt)}</td><td>${row.correctCpm}</td><td>${escapar(row.ppm)}</td><td>${escapar(row.accuracy)} %</td><td>${row.errorCount}</td><td>${result(row.passed)}${row.suspicious ? ' ⚠' : ''}</td><td>${escapar(row.closeReason ?? 'En curso')}</td><td>${row.configVersion ? `v${row.configVersion}` : '—'}</td></tr>`).join('') || helpers.empty(10)}
      </tbody></table></div>
      <h3>Excel</h3>
      <div class="table-wrap"><table><thead><tr><th>#</th><th>Fecha</th><th>Nota</th><th>Resultado</th><th>Pasos con error</th></tr></thead><tbody>
      ${office.excel.map((row) => `<tr><td>${row.number}</td><td>${formatDate(row.completedAt)}</td><td>${escapar(row.score ?? '—')}</td><td>${result(row.passed)}</td><td>${escapar((row.steps ?? []).filter((step) => !step.correct).map((step) => step.questionId).join(', ') || '—')}</td></tr>`).join('') || helpers.empty(5)}
      </tbody></table></div>
      <h3>Dictado</h3>
      <div class="table-wrap"><table><thead><tr><th>#</th><th>Ejercicio</th><th>Fecha</th><th>Nota</th><th>Críticos</th><th>Resultado</th><th>Errores</th><th>Recomendación</th></tr></thead><tbody>
      ${office.dictation.map((row) => `<tr><td>${row.number}</td><td>${escapar(row.exercise.title)}</td><td>${formatDate(row.completedAt)}</td><td>${escapar(row.score ?? '—')}</td><td>${row.criticalCount ?? '—'}</td><td>${result(row.passed)}</td>
        <td>${escapar((row.errors ?? []).slice(0, 3).map((error) => `${error.expected || '∅'} → ${error.written || '∅'}`).join('; ') || '—')}</td>
        <td>${escapar(row.recommendation?.resumen ?? '—')} ${row.recommendationSource ? `<small>(${row.recommendationSource === 'OLLAMA' ? 'Ollama' : 'plantilla'})</small>` : ''}</td></tr>`).join('') || helpers.empty(8)}
      </tbody></table></div>
    </section>`;
}
