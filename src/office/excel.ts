import { officeApi, type ExcelPractice, type ExcelResult, type Lesson } from './api';
import { mountOfficeRetry, showError, type OfficeContext } from './office';
import { mountExcelLessons } from './excel-lessons';
import { renderPractice } from './excel-sheet';
import { EXCEL_PASS_SCORE } from '../../server/domain/excel-practice';

export async function renderExcel(ctx: OfficeContext): Promise<void> {
  const info = await officeApi.excelActivity();
  if (info.practice?.status === 'IN_PROGRESS') {
    // Inicializa también los intentos abiertos de la evaluación anterior.
    startPractice(ctx, info.id, await officeApi.excelStart(info.id));
    return;
  }
  if (info.result) { renderResult(ctx, info.id, info.result); return; }
  if (ctx.state.sections.find(item => item.key === 'excel')?.status === 'COMPLETED') {
    ctx.view.innerHTML = `<section class="office-card"><p class="eyebrow">EXCEL PARA COBRANZAS</p><h1>Excel aprobado</h1><p>Tu aprobación anterior se conserva.</p><div class="office-actions"><button class="primary" id="excel-next">Continuar con Ortografía →</button><button class="office-secondary" id="excel-review">Repasar lecciones</button></div></section>`;
    ctx.view.querySelector('#excel-next')!.addEventListener('click', () => ctx.go('ortografia'));
    ctx.view.querySelector('#excel-review')!.addEventListener('click', () => renderLessons(ctx, null, info.lessons));
    return;
  }
  renderLessons(ctx, info.id, info.lessons);
}

function renderLessons(ctx: OfficeContext, id: string | null, lessons: Lesson[]): void {
  mountExcelLessons(ctx, lessons, { practice: id !== null, onComplete: async () => {
    if (!id) { await renderExcel(ctx); return; }
    const panel = ctx.view.firstElementChild;
    const practice = await officeApi.excelStart(id);
    if (panel && ctx.view.contains(panel)) startPractice(ctx, id, practice);
  } });
}

function startPractice(ctx: OfficeContext, id: string, practice: ExcelPractice): void {
  renderPractice(ctx, id, practice, result => renderResult(ctx, id, result));
}

function renderResult(ctx: OfficeContext, id: string, practice: ExcelResult): void {
  const score = practice.score; const passed = practice.passed;
  ctx.view.innerHTML = `<section class="office-card"><p class="eyebrow">EXCEL PARA COBRANZAS · RESULTADO</p><h1 tabindex="-1">${passed ? '¡Práctica aprobada!' : 'Sigue practicando'}</h1><div class="office-metrics"><div><strong>${score} / 100</strong><span>Mínimo de aprobación: ${EXCEL_PASS_SCORE} puntos</span></div></div>
    <p class="office-note">Tu resultado quedó registrado. La hoja y las respuestas del intento enviado ya no están disponibles. Puedes repasar las lecciones.</p>
    <div class="office-actions">${passed ? '<button class="primary" id="excel-next">Continuar con Ortografía →</button>' : ctx.state.sections.find(s => s.key === 'excel')?.status === 'PENDING' ? '<button class="primary" id="excel-retry">Comenzar mi intento habilitado →</button>' : ''}<button class="office-secondary" id="excel-review">Repasar lecciones</button></div></section>`;
  ctx.view.querySelector('#excel-next')?.addEventListener('click', () => ctx.go('ortografia'));
  ctx.view.querySelector<HTMLButtonElement>('#excel-retry')?.addEventListener('click', async event => {
    const button = event.currentTarget as HTMLButtonElement; button.disabled = true;
    try { startPractice(ctx, id, await officeApi.excelStart(id)); }
    catch (error) { button.disabled = false; showError(ctx.view, error); }
  });
  ctx.view.querySelector('#excel-review')?.addEventListener('click', async () => {
    try { const info = await officeApi.excelActivity(); renderLessons(ctx, null, info.lessons); }
    catch (error) { showError(ctx.view, error); }
  });
  ctx.view.querySelector<HTMLElement>('h1')?.focus();
  if (!passed) {
    const activityId = ctx.state.sections.find(section => section.key === 'excel')?.activityId;
    if (activityId) mountOfficeRetry(ctx, activityId, () => {
      void ctx.refresh().then(() => officeApi.excelStart(id)).then(attempt => startPractice(ctx, id, attempt)).catch(error => showError(ctx.view, error));
    });
  }
}
