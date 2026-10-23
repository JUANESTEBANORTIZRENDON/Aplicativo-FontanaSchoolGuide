import { escapar } from '../http';
import { officeApi, type ExcelPractice, type Lesson } from './api';
import { showError, type OfficeContext } from './office';
import { mountExcelLessons } from './excel-lessons';
import { renderPractice } from './excel-sheet';
import { EXCEL_PASS_SCORE, practiceScore, practiceSteps } from '../../server/domain/excel-practice';

export async function renderExcel(ctx: OfficeContext): Promise<void> {
  const info = await officeApi.excelActivity();
  if (info.practice?.status === 'IN_PROGRESS') {
    // Inicializa también los intentos abiertos de la evaluación anterior.
    startPractice(ctx, info.id, await officeApi.excelStart(info.id));
    return;
  }
  if (info.practice) { renderResult(ctx, info.id, info.practice); return; }
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

function renderResult(ctx: OfficeContext, id: string, practice: ExcelPractice): void {
  const score = practiceScore(practice.state); const passed = practice.status === 'PASSED';
  ctx.view.innerHTML = `<section class="office-card"><p class="eyebrow">EXCEL PARA COBRANZAS · RESULTADO</p><h1 tabindex="-1">${passed ? '¡Práctica aprobada!' : 'Sigue practicando'}</h1><div class="office-metrics"><div><strong>${score} / 100</strong><span>Mínimo de aprobación: ${EXCEL_PASS_SCORE} puntos</span></div></div>
    <ol class="office-feedback">${practiceSteps(practice.state).map(step => `<li data-ok="${step.correct}"><strong>${step.correct ? '✓ Completado' : '↳ Pendiente de refuerzo'} · ${escapar(step.title)} · ${step.awardedScore.toLocaleString('es-CO')}/${step.weight.toLocaleString('es-CO')}</strong>${!step.correct ? `<span>${escapar(step.hint)}</span>` : ''}</li>`).join('')}</ol>
    <p class="office-note">El resultado y la observación guardada se conservan en tu perfil. También se registra si usaste atajos de teclado o los botones de la cinta.</p>
    ${practice.state.savedRows ? `<details class="excel-help"><summary>Ver observación guardada</summary><p>Camila Rojas: ${escapar(practice.state.savedRows.find(row => row.id === 'c1')?.observacion)}</p></details>` : ''}
    <div class="office-actions">${passed ? '<button class="primary" id="excel-next">Continuar con Ortografía →</button>' : '<button class="primary" id="excel-retry">Volver a practicar (sin límite de intentos)</button>'}<button class="office-secondary" id="excel-review">Repasar lecciones</button></div></section>`;
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
}
