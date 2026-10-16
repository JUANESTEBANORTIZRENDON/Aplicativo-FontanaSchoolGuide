import { escapar } from '../http';
import { ApiError, officeApi, type ExcelPractice, type ExcelResult, type ExcelStep, type Lesson } from './api';
import { MiniSheet } from './mini-sheet';
import { errorMessage, lessonCard, showError, type OfficeContext } from './office';

// Excel para cobranzas: cuatro microlecciones y una práctica con datos ficticios en una mini hoja.
// El servidor califica cada paso; aquí solo se recogen las respuestas y se muestra la retroalimentación.

type SheetKey = 'busquedas' | 'volver' | 'acuerdos' | 'pagos';
const SHEET_TITLE: Record<SheetKey, string> = { busquedas: 'Búsquedas', volver: 'Volver a llamar', acuerdos: 'Acuerdos', pagos: 'Pagos' };
const AGREEMENT_STATES = ['Pendiente', 'Cumplido', 'Incumplido'];

export async function renderExcel(ctx: OfficeContext): Promise<void> {
  const section = ctx.state.sections.find((item) => item.key === 'excel')!;
  const cfg = ctx.state.config.excel;
  if (section.status === 'COMPLETED') {
    ctx.view.innerHTML = `
      <section class="office-card">
        <p class="eyebrow">EXCEL PARA COBRANZAS</p><h1>Práctica de Excel aprobada</h1>
        <p class="office-lead">Ya superaste los ${cfg.minScore} puntos de la práctica.</p>
        <div class="office-actions"><button class="primary" id="excel-next" type="button">Continuar con Ortografía →</button></div>
      </section>`;
    ctx.view.querySelector('#excel-next')!.addEventListener('click', () => ctx.go('ortografia'));
    return;
  }
  if (section.status === 'NO_ATTEMPTS') {
    ctx.view.innerHTML = `<section class="office-card"><p class="eyebrow">EXCEL PARA COBRANZAS</p><h1>Sin intentos disponibles</h1><p class="office-error">Agotaste los intentos de la práctica. Solicita una reactivación al administrador.</p><a class="office-secondary" href="${escapar(ctx.backHref)}">Volver a tu ruta de formación</a></section>`;
    return;
  }
  const activity = await officeApi.excelActivity();
  // Un intento abierto se reanuda con el mismo escenario.
  if (activity.attemptId && activity.sheets && activity.steps) {
    renderPractice(ctx, activity.id, {
      attemptId: activity.attemptId, number: 0, resumed: true, title: activity.title, baseDate: activity.baseDate ?? '', steps: activity.steps, sheets: activity.sheets,
    });
    return;
  }
  renderLessons(ctx, activity.id, activity.lessons);
}

function renderLessons(ctx: OfficeContext, activityId: string, lessons: Lesson[]): void {
  const section = ctx.state.sections.find((item) => item.key === 'excel')!;
  const cfg = ctx.state.config.excel;
  const viewed = new Set(section.lessonsViewed);
  let index = Math.min(lessons.findIndex((lesson) => !viewed.has(lesson.key)), lessons.length - 1);
  if (index < 0) index = 0;

  const draw = () => {
    const lesson = lessons[index]!;
    void officeApi.view(lesson.key).then(() => viewed.add(lesson.key)).catch(() => undefined);
    ctx.view.innerHTML = `
      <section class="office-card" aria-labelledby="excel-title">
        <p class="eyebrow">EXCEL PARA COBRANZAS · LECCIÓN ${index + 1} DE ${lessons.length}</p>
        <h1 id="excel-title">${escapar(lesson.title)}</h1>
        ${lessonCard(lesson)}
        <p class="office-note">La práctica final vale 100 puntos y se aprueba con ${cfg.minScore}. Usa datos ficticios.</p>
        <div class="office-actions">
          <button class="office-secondary" id="lesson-prev" type="button" ${index === 0 ? 'disabled' : ''}>← Anterior</button>
          ${index < lessons.length - 1
            ? '<button class="primary" id="lesson-next" type="button">Siguiente lección →</button>'
            : '<button class="primary" id="lesson-practice" type="button">Ir a la práctica →</button>'}
        </div>
      </section>`;
    ctx.view.querySelector('#lesson-prev')!.addEventListener('click', () => { index -= 1; draw(); });
    ctx.view.querySelector('#lesson-next')?.addEventListener('click', () => { index += 1; draw(); });
    const start = ctx.view.querySelector<HTMLButtonElement>('#lesson-practice');
    start?.addEventListener('click', async () => {
      start.disabled = true;
      start.textContent = 'Preparando la práctica…';
      try {
        renderPractice(ctx, activityId, await officeApi.excelStart(activityId));
      } catch (error) {
        start.disabled = false;
        start.textContent = 'Ir a la práctica →';
        showError(ctx.view, error);
      }
    });
  };
  draw();
}

function renderPractice(ctx: OfficeContext, activityId: string, practice: ExcelPractice): void {
  const cfg = ctx.state.config.excel;
  const keys: SheetKey[] = ['busquedas', 'volver', 'acuerdos', 'pagos'];
  const answers = new Map<string, string | number | Record<string, string | number>>();
  const lessonSheet: Record<string, SheetKey> = { busquedas: 'busquedas', volver: 'volver', acuerdos: 'acuerdos', pagos: 'pagos' };

  ctx.view.innerHTML = `
    <section class="office-card office-wide" aria-labelledby="excel-title">
      <p class="eyebrow">EXCEL PARA COBRANZAS · PRÁCTICA</p>
      <h1 id="excel-title">${escapar(practice.title)}</h1>
      <p class="office-lead">Sigue las ocho instrucciones. Confirma cada paso y, al final, envía la práctica. Se aprueba con ${cfg.minScore} puntos. Todos los datos son ficticios.</p>
      <div class="office-excel">
        <div class="office-excel-sheet">
          <div class="office-tabs" role="tablist" aria-label="Hojas de la práctica">
            ${keys.map((key, i) => `<button type="button" role="tab" id="tab-${key}" aria-controls="panel-${key}" aria-selected="${i === 0}" data-sheet="${key}">${SHEET_TITLE[key]}</button>`).join('')}
          </div>
          ${keys.map((key, i) => `<div role="tabpanel" id="panel-${key}" aria-labelledby="tab-${key}" ${i === 0 ? '' : 'hidden'}><div class="sheet-host" data-host="${key}"></div></div>`).join('')}
        </div>
        <ol class="office-step-list" id="excel-steps" aria-label="Instrucciones de la práctica"></ol>
      </div>
      <p id="excel-progress" class="office-note" role="status"></p>
      <div class="office-actions"><button class="primary" id="excel-submit" type="button">Enviar práctica</button></div>
    </section>`;

  // ---- Hojas ----
  const sheets = {} as Record<SheetKey, MiniSheet>;
  const host = (key: SheetKey) => ctx.view.querySelector<HTMLElement>(`[data-host="${key}"]`)!;
  sheets.busquedas = new MiniSheet(host('busquedas'), {
    caption: 'Clientes: busca y filtra para ubicar a una persona', ...practice.sheets.busquedas, filterable: ['empresa'], searchable: true, selectable: true,
  });
  sheets.volver = new MiniSheet(host('volver'), { caption: 'Devoluciones de llamada programadas', ...practice.sheets.volver });
  sheets.acuerdos = new MiniSheet(host('acuerdos'), {
    caption: 'Acuerdos de pago: completa la fila resaltada', ...practice.sheets.acuerdos,
    editor: (row, column) => {
      if (row.id !== 'a-open') return null;
      if (column.key === 'valor') return { kind: 'number' };
      if (column.key === 'estado') return { kind: 'select', options: AGREEMENT_STATES };
      if (column.key === 'fecha') return { kind: 'date' };
      return null;
    },
  });
  sheets.pagos = new MiniSheet(host('pagos'), {
    caption: 'Pagos: la fila 2 es el primer cliente (celdas A a J)', ...practice.sheets.pagos,
    editor: (row, column) => (row.id === practice.sheets.pagos.rows[0]?.id && column.key === 'faltante' ? { kind: 'formula' } : null),
  });

  const tabs = [...ctx.view.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const selectTab = (key: SheetKey) => {
    tabs.forEach((tab) => {
      const active = tab.dataset.sheet === key;
      tab.setAttribute('aria-selected', String(active));
      ctx.view.querySelector<HTMLElement>(`#panel-${tab.dataset.sheet}`)!.hidden = !active;
    });
  };
  tabs.forEach((tab) => tab.addEventListener('click', () => selectTab(tab.dataset.sheet as SheetKey)));

  // ---- Pasos ----
  const list = ctx.view.querySelector<HTMLOListElement>('#excel-steps')!;
  const progress = ctx.view.querySelector<HTMLElement>('#excel-progress')!;
  const confirmed = new Set<string>();
  const updateProgress = () => { progress.textContent = `${confirmed.size} de ${practice.steps.length} pasos confirmados.`; };
  const markDone = (item: HTMLElement, id: string, text = 'Paso confirmado') => {
    confirmed.add(id);
    item.dataset.state = 'done';
    item.querySelector<HTMLElement>('.office-step-state')!.textContent = text;
    updateProgress();
  };
  const warn = (item: HTMLElement, message: string) => { item.querySelector<HTMLElement>('.office-step-state')!.textContent = message; item.dataset.state = 'warn'; };

  practice.steps.forEach((step: ExcelStep, position) => {
    const sheet = lessonSheet[step.lesson] ?? 'busquedas';
    const item = document.createElement('li');
    item.dataset.q = step.questionId;
    item.innerHTML = `
      <p class="office-step-text"><span class="office-step-number">${position + 1}</span> ${escapar(step.instruction)}</p>
      <div class="office-step-controls"></div>
      <p class="office-step-state" role="status"></p>`;
    const controls = item.querySelector<HTMLElement>('.office-step-controls')!;
    const goto = document.createElement('button');
    goto.type = 'button';
    goto.className = 'office-link';
    goto.textContent = `Ir a la hoja «${SHEET_TITLE[sheet]}»`;
    goto.addEventListener('click', () => selectTab(sheet));
    controls.append(goto);
    const confirm = (label: string, handler: () => void) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'office-confirm';
      button.textContent = label;
      button.addEventListener('click', handler);
      controls.append(button);
    };

    if (step.kind === 'filter') {
      confirm('Confirmar filtro', () => {
        const value = sheets.busquedas.getFilter('empresa');
        if (!value) { warn(item, 'Aplica primero el filtro en la columna Empresa.'); return; }
        answers.set(step.questionId, value);
        markDone(item, step.questionId, `Filtro confirmado: ${value}`);
      });
    } else if (step.kind === 'select') {
      confirm('Confirmar cliente seleccionado', () => {
        const id = sheets.busquedas.getSelectedId();
        const row = id ? sheets.busquedas.getRow(id) : undefined;
        if (!row) { warn(item, 'Haz clic en la fila del cliente para seleccionarlo.'); return; }
        answers.set(step.questionId, String(row.cedula));
        markDone(item, step.questionId, `Cliente seleccionado: ${row.cliente}`);
      });
    } else if (step.kind === 'append-callback') {
      const form = document.createElement('div');
      form.className = 'office-mini-form';
      form.innerHTML = `
        <label>Cliente<input name="cliente" type="text" autocomplete="off" placeholder="Nombre del cliente"></label>
        <label>Fecha<input name="fecha" type="date"></label>
        <label>Hora<input name="hora" type="time"></label>`;
      controls.append(form);
      confirm('Agregar y confirmar', () => {
        const value = {
          cliente: form.querySelector<HTMLInputElement>('[name="cliente"]')!.value.trim(),
          fecha: form.querySelector<HTMLInputElement>('[name="fecha"]')!.value,
          hora: form.querySelector<HTMLInputElement>('[name="hora"]')!.value,
        };
        if (!value.cliente || !value.fecha || !value.hora) { warn(item, 'Completa cliente, fecha y hora.'); return; }
        sheets.volver.addRow({ id: 'v-new', cliente: value.cliente, telefono: '', fecha: value.fecha, hora: value.hora, motivo: 'Devolución de llamada', asesor: '' });
        answers.set(step.questionId, value);
        markDone(item, step.questionId, 'Fila agregada a la hoja «Volver a llamar».');
      });
    } else if (step.kind === 'sorted') {
      confirm('Confirmar orden actual', () => {
        if (!sheets.volver.hasRow('v-new')) { warn(item, 'Primero agrega la devolución de llamada (paso anterior).'); return; }
        const sort = sheets.volver.getSort();
        if (!sort || sort.key !== 'fecha') { warn(item, 'Ordena la columna Fecha de seguimiento con su botón de orden.'); return; }
        answers.set(step.questionId, sheets.volver.getVisibleIds().join(','));
        markDone(item, step.questionId, 'Orden confirmado.');
      });
    } else if (step.kind === 'agreement') {
      confirm('Confirmar acuerdo', () => {
        const valor = sheets.acuerdos.getEdit('a-open', 'valor');
        const estado = sheets.acuerdos.getEdit('a-open', 'estado');
        const fecha = sheets.acuerdos.getEdit('a-open', 'fecha');
        if (!valor || !estado || !fecha) { warn(item, 'Completa valor, estado y fecha en la fila resaltada.'); return; }
        answers.set(step.questionId, { valor: Number(valor), estado, fecha });
        markDone(item, step.questionId, 'Acuerdo confirmado.');
      });
    } else if (step.kind === 'formula-difference') {
      confirm('Confirmar fórmula', () => {
        const rowId = practice.sheets.pagos.rows[0]!.id;
        const formula = sheets.pagos.getEdit(rowId, 'faltante').trim();
        if (!formula.startsWith('=')) { warn(item, 'Escribe la fórmula en la celda J2; debe empezar con =.'); return; }
        answers.set(step.questionId, formula);
        markDone(item, step.questionId, `Fórmula confirmada: ${formula}`);
      });
    } else if (step.kind === 'formula-sum') {
      const field = document.createElement('div');
      field.className = 'office-mini-form';
      field.innerHTML = '<label>Fórmula del total<input name="total" type="text" autocomplete="off" spellcheck="false" placeholder="=…"></label><output class="sheet-formula-value"></output>';
      controls.append(field);
      const input = field.querySelector<HTMLInputElement>('input')!;
      const output = field.querySelector<HTMLOutputElement>('output')!;
      input.addEventListener('input', () => { output.textContent = input.value.startsWith('=') ? sheets.pagos.evaluate(input.value) : ''; });
      confirm('Confirmar fórmula', () => {
        const formula = input.value.trim();
        if (!formula.startsWith('=')) { warn(item, 'La fórmula debe empezar con =.'); return; }
        answers.set(step.questionId, formula);
        markDone(item, step.questionId, `Fórmula confirmada: ${formula}`);
      });
    } else if (step.kind === 'format') {
      const select = document.createElement('select');
      select.setAttribute('aria-label', 'Formato de la columna Saldo');
      select.innerHTML = `<option value="">Elige un formato…</option>${(step.options ?? []).map((option) => `<option value="${escapar(option.value)}">${escapar(option.label)}</option>`).join('')}`;
      select.addEventListener('change', () => sheets.pagos.setCurrency(select.value === 'cop'));
      controls.append(select);
      confirm('Confirmar formato', () => {
        if (!select.value) { warn(item, 'Elige un formato.'); return; }
        answers.set(step.questionId, select.value);
        markDone(item, step.questionId, 'Formato confirmado.');
      });
    }
    list.append(item);
  });
  updateProgress();

  // ---- Envío (una sola vez por intento) ----
  const submit = ctx.view.querySelector<HTMLButtonElement>('#excel-submit')!;
  let sent = false;
  submit.addEventListener('click', async () => {
    if (sent) return;
    sent = true;
    submit.disabled = true;
    submit.textContent = 'Calificando…';
    try {
      const result = await officeApi.excelSubmit(activityId, {
        attemptId: practice.attemptId,
        steps: [...answers.entries()].map(([questionId, value]) => ({ questionId, value })),
      });
      await ctx.refresh().catch(() => undefined);
      renderResult(ctx, activityId, result, practice.steps);
    } catch (error) {
      sent = false;
      submit.disabled = false;
      submit.textContent = 'Enviar práctica';
      if (error instanceof ApiError && error.code === 'ATTEMPT_CLOSED') { await ctx.reload(); return; }
      showError(ctx.view, error);
    }
  });
}

function renderResult(ctx: OfficeContext, activityId: string, result: ExcelResult, steps: ExcelStep[]): void {
  const text = new Map(steps.map((step) => [step.questionId, step.instruction]));
  ctx.view.innerHTML = `
    <section class="office-card" aria-labelledby="excel-result-title">
      <p class="eyebrow">EXCEL PARA COBRANZAS · INTENTO ${result.attemptNumber || ''}</p>
      <h1 id="excel-result-title">${result.passed ? '¡Práctica aprobada!' : 'Todavía no alcanzas el puntaje'}</h1>
      <div class="office-metrics">
        <div><strong>${result.score.toFixed(0)}</strong><span>puntos de 100</span><small>Mínimo: ${result.minScore}</small></div>
        <div><strong>${result.steps.filter((step) => step.correct).length} / ${result.steps.length}</strong><span>pasos correctos</span></div>
      </div>
      <ol class="office-feedback">
        ${result.steps.map((step) => `<li data-ok="${step.correct}"><strong>${step.correct ? '✓' : '✗'} ${escapar(text.get(step.questionId) ?? step.questionId)}</strong><span>${escapar(step.feedback)} (${step.awardedScore}/${step.weight} puntos)</span></li>`).join('')}
      </ol>
      <div class="office-actions">
        ${result.passed ? '<button class="primary" id="excel-next" type="button">Continuar con Ortografía →</button>'
          : result.attemptsRemaining ? `<button class="primary" id="excel-retry" type="button">Intentar de nuevo (${result.attemptsRemaining} restantes)</button>`
            : '<p class="office-error">Agotaste los intentos. Solicita una reactivación al administrador.</p>'}
      </div>
    </section>`;
  ctx.view.querySelector('#excel-next')?.addEventListener('click', () => ctx.go('ortografia'));
  const retry = ctx.view.querySelector<HTMLButtonElement>('#excel-retry');
  retry?.addEventListener('click', async () => {
    retry.disabled = true;
    try {
      renderPractice(ctx, activityId, await officeApi.excelStart(activityId));
    } catch (error) {
      retry.disabled = false;
      ctx.view.insertAdjacentHTML('afterbegin', `<p class="office-error" role="alert">${escapar(errorMessage(error))}</p>`);
    }
  });
}
