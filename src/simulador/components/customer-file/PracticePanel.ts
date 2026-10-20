// Panel de la prueba de tipificación, arriba de la ficha del cliente: audio de la llamada y los checkmarks de lo que
// debe tener la tipificación. Al guardar, el sistema experto los llena (✓ cumple · ✗ falta, con la explicación).

import type { SimContext } from '../../context';
import type { Evaluation } from '../../domain/expert/engine';
import { EXERCISE_PORTFOLIO, EXERCISES, type Exercise } from '../../domain/expert/exercises';
import { combine, on, qs, type Cleanup } from '../../utils/dom';
import { esc } from '../../utils/format';
import { hydrateIcons, icon } from '../icons';
import { openModal } from '../Modal';

export interface PracticePanel {
  showEvaluation(evaluation: Evaluation): void;
  cleanup: Cleanup;
}

function progressTemplate(ctx: SimContext, current: Exercise): string {
  const results = ctx.store.get().practice.results;
  return EXERCISES.map((e) => {
    const r = results[e.id];
    const state = e.id === current.id ? 'current' : r?.approved ? 'ok' : r ? 'bad' : 'pending';
    return `<li class="sim-practice__step is-${state}" title="Ejercicio ${e.number}: ${esc(e.title)}${r ? ` · ${r.score} %` : ''}">${r?.approved ? '✓' : e.number}</li>`;
  }).join('');
}

function checklistTemplate(exercise: Exercise, evaluation?: Evaluation): string {
  return exercise.rules
    .map((rule) => {
      const item = evaluation?.items.find((i) => i.id === rule.id && i.label === rule.label);
      const state = !item ? 'pending' : item.ok ? 'ok' : 'bad';
      return `<li class="sim-check-item is-${state}">
        <span class="sim-check-item__box" aria-hidden="true">${state === 'ok' ? '✓' : state === 'bad' ? '✗' : ''}</span>
        <span><strong>${esc(rule.goal ?? rule.label)}</strong>${item ? `<small>${item.ok ? '' : `${esc(rule.label)}. `}${esc(item.detail)}</small>` : ''}</span>
        <span class="sim-visually-hidden">${state === 'ok' ? 'cumple' : state === 'bad' ? 'no cumple' : 'pendiente'}</span>
      </li>`;
    })
    .join('');
}

async function showSummary(ctx: SimContext): Promise<void> {
  const results = ctx.store.get().practice.results;
  const done = EXERCISES.filter((e) => results[e.id]);
  const approved = EXERCISES.filter((e) => results[e.id]?.approved).length;
  const average = done.length ? Math.round(done.reduce((s, e) => s + results[e.id]!.score, 0) / EXERCISES.length) : 0;
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'tipifica:prueba', approved, total: EXERCISES.length, average }, location.origin);
  }
  ctx.store.endPractice();
  await openModal(ctx.root, {
    title: 'Resultado de la prueba de tipificación',
    wide: true,
    body: `
      <p class="sim-practice__summary"><strong>${approved} de ${EXERCISES.length}</strong> llamadas tipificadas correctamente · puntaje promedio <strong>${average} %</strong></p>
      <table class="sim-table sim-table--compact"><thead><tr><th>Ejercicio</th><th>Puntaje</th><th>Intentos</th><th>Estado</th></tr></thead><tbody>
      ${EXERCISES.map((e) => {
        const r = results[e.id];
        return `<tr><td>${e.number}. ${esc(e.title)}</td><td>${r ? `${r.score} %` : '—'}</td><td>${r?.attempts ?? 0}</td><td>${r?.approved ? '✓ Aprobado' : r ? '✗ Por mejorar' : 'Sin presentar'}</td></tr>`;
      }).join('')}
      </tbody></table>
      <p class="sim-help">${approved === EXERCISES.length ? '¡Excelente! Tipificas como en la operación.' : 'Puedes repetir los ejercicios que quedaron por mejorar: abre la guía y pulsa «Iniciar la prueba de tipificación».'}</p>`,
  });
}

export function mountPracticePanel(host: HTMLElement, ctx: SimContext, exercise: Exercise, opts: { onRetry(): void }): PracticePanel {
  const isLast = exercise.number === EXERCISES.length;
  host.innerHTML = `
    <section class="sim-card sim-practice" data-sim-guide="prueba.panel" aria-labelledby="sim-practice-title">
      <header class="sim-practice__head">
        <div>
          <p class="sim-practice__kicker">${icon('ClipboardList')} Prueba de tipificación · Ejercicio ${exercise.number} de ${EXERCISES.length}</p>
          <h2 id="sim-practice-title" class="sim-practice__title">${esc(exercise.title)}</h2>
          <p class="sim-practice__brief">${esc(exercise.brief)} Luego tipifícala en «Nueva Gestión» y pulsa «Guardar».</p>
        </div>
        <ol class="sim-practice__steps" aria-label="Avance de la prueba" data-progress>${progressTemplate(ctx, exercise)}</ol>
      </header>
      <div class="sim-practice__audio" data-sim-guide="prueba.audio">
        <span>${icon('Headphones')} Llamada grabada</span>
        <audio controls preload="none" src="${esc(exercise.audio)}">Tu navegador no reproduce el audio.</audio>
      </div>
      <div class="sim-practice__checks" data-sim-guide="prueba.checks">
        <p class="sim-practice__subtitle">Lo que debe tener esta tipificación</p>
        <ol class="sim-check-list" data-checks>${checklistTemplate(exercise)}</ol>
      </div>
      <footer class="sim-practice__foot">
        <p class="sim-practice__score" data-score aria-live="polite">Escucha el audio completo antes de tipificar.</p>
        <div class="sim-practice__actions">
          <button type="button" class="sim-btn sim-btn--ghost" data-practice="retry" hidden>${icon('RotateCcw')} Intentar de nuevo</button>
          <button type="button" class="sim-btn sim-btn--primary" data-practice="next">${isLast ? `${icon('Check')} Ver resultados` : `Siguiente ejercicio ${icon('ArrowRight')}`}</button>
        </div>
      </footer>
    </section>`;
  hydrateIcons(host);

  const checks = qs(host, '[data-checks]');
  const score = qs(host, '[data-score]');

  return {
    showEvaluation(evaluation) {
      const result = ctx.store.recordPractice(exercise.id, evaluation.score, evaluation.approved);
      checks.innerHTML = checklistTemplate(exercise, evaluation);
      qs(host, '[data-progress]').innerHTML = progressTemplate(ctx, exercise);
      score.innerHTML = evaluation.approved
        ? `<strong class="is-ok">✓ Tipificación correcta (${evaluation.score} %).</strong> Pasa al siguiente ejercicio.`
        : `<strong class="is-bad">${evaluation.passed} de ${evaluation.total} puntos (${evaluation.score} %).</strong> Revisa lo marcado con ✗ e inténtalo de nuevo. Intento ${result.attempts}.`;
      qs<HTMLElement>(host, '[data-practice="retry"]').hidden = evaluation.approved;
      host.querySelector('.sim-practice')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    },
    cleanup: combine([
      () => {
        host.querySelector('audio')?.pause();
        host.innerHTML = '';
      },
      on(host, 'click', (event) => {
        const action = (event.target as HTMLElement).closest<HTMLElement>('[data-practice]')?.dataset.practice;
        if (action === 'retry') {
          checks.innerHTML = checklistTemplate(exercise);
          score.textContent = 'Corrige la tipificación y vuelve a guardar.';
          opts.onRetry();
        } else if (action === 'next') {
          if (isLast) void showSummary(ctx);
          else ctx.navigate(`/cartera/${EXERCISE_PORTFOLIO}/cliente/${EXERCISES[exercise.number]!.customer.id}`);
        }
      }),
    ]),
  };
}

/** Lleva al primer ejercicio sin aprobar (o al primero) y activa la prueba. */
export function startPractice(ctx: SimContext, restart = false): void {
  ctx.store.startPractice(restart);
  const results = ctx.store.get().practice.results;
  const next = EXERCISES.find((e) => !results[e.id]?.approved) ?? EXERCISES[0]!;
  ctx.navigate(`/cartera/${EXERCISE_PORTFOLIO}/cliente/${next.customer.id}`);
}
