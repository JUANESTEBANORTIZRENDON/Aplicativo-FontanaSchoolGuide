// Panel de la prueba de tipificación, arriba de la ficha del cliente: audio de la llamada y los checkmarks de lo que
// debe tener la tipificación. Al guardar, el sistema experto los llena (✓ cumple · ✗ falta, con la explicación).
// Dentro de Fontana School la prueba es oficial: califica el servidor, cada ejercicio tiene un intento y el
// resultado queda guardado (recargar el clon o limpiar el navegador no lo cambia). En el clon suelto o en modo
// repaso es una práctica libre que se puede repetir.

import type { SimContext } from '../../context';
import type { Evaluation } from '../../domain/expert/engine';
import type { CustomerView } from '../../types/simulator';
import { EXERCISE_PORTFOLIO, EXERCISES, type Exercise } from '../../domain/expert/exercises';
import {
  isOfficial, officialExercise, officialState, requestOfficialReactivation, toEvaluation, type OfficialExercise,
} from '../../domain/expert/official';
import { combine, on, qs, type Cleanup } from '../../utils/dom';
import { esc, formatCOP } from '../../utils/format';
import { hydrateIcons, icon } from '../icons';
import { openModal } from '../Modal';

export interface PracticePanel {
  showEvaluation(evaluation: Evaluation, official?: OfficialExercise | null): void;
  /** Vuelve a dibujar el panel cuando llega (o cambia) el estado oficial de la prueba. */
  refreshOfficial(): void;
  cleanup: Cleanup;
}

function stepState(ctx: SimContext, exercise: Exercise, current: Exercise): string {
  if (exercise.id === current.id) return 'current';
  const official = isOfficial() ? officialExercise(exercise.number) : null;
  if (official) return official.status === 'APROBADO' ? 'ok' : official.result ? 'bad' : 'pending';
  const r = ctx.store.get().practice.results[exercise.id];
  return r?.approved ? 'ok' : r ? 'bad' : 'pending';
}

function progressTemplate(ctx: SimContext, current: Exercise): string {
  return EXERCISES.map((e) => {
    const state = stepState(ctx, e, current);
    const official = isOfficial() ? officialExercise(e.number) : null;
    return `<li class="sim-practice__step is-${state}" title="Ejercicio ${e.number}: ${esc(e.title)}${official ? ` · ${esc(official.statusLabel)}` : ''}">${state === 'ok' ? '✓' : e.number}</li>`;
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
  const official = isOfficial() ? officialState() : null;
  ctx.store.endPractice();
  if (official) {
    const pendingRows = official.exercises.filter((e) => !e.result).length;
    await openModal(ctx.root, {
      title: 'Tu prueba oficial de tipificación',
      wide: true,
      body: `
        <p class="sim-practice__summary"><strong>${official.approvedCount} de ${official.total}</strong> ejercicios aprobados</p>
        <table class="sim-table sim-table--compact"><thead><tr><th>Ejercicio</th><th>Puntaje</th><th>Estado</th></tr></thead><tbody>
        ${official.exercises.map((e) => `<tr><td>${e.number}. ${esc(EXERCISES[e.number - 1]?.title ?? '')}</td><td>${e.result?.score ? `${Math.round(Number(e.result.score))} %` : '—'}</td><td>${esc(e.statusLabel)}</td></tr>`).join('')}
        </tbody></table>
        <p class="sim-help">${official.passed ? '¡Aprobaste los seis ejercicios! Ya puedes presentar el examen general.' : pendingRows ? 'Aún tienes ejercicios por presentar. Cada uno tiene un solo intento.' : 'Para volver a presentar un ejercicio no aprobado solicita la reactivación al administrador.'}</p>`,
    });
    return;
  }
  const results = ctx.store.get().practice.results;
  const done = EXERCISES.filter((e) => results[e.id]);
  const approved = EXERCISES.filter((e) => results[e.id]?.approved).length;
  const average = done.length ? Math.round(done.reduce((s, e) => s + results[e.id]!.score, 0) / EXERCISES.length) : 0;
  await openModal(ctx.root, {
    title: 'Resultado de la práctica de tipificación',
    wide: true,
    body: `
      <p class="sim-practice__summary"><strong>${approved} de ${EXERCISES.length}</strong> llamadas tipificadas correctamente · puntaje promedio <strong>${average} %</strong></p>
      <table class="sim-table sim-table--compact"><thead><tr><th>Ejercicio</th><th>Puntaje</th><th>Intentos</th><th>Estado</th></tr></thead><tbody>
      ${EXERCISES.map((e) => {
        const r = results[e.id];
        return `<tr><td>${e.number}. ${esc(e.title)}</td><td>${r ? `${r.score} %` : '—'}</td><td>${r?.attempts ?? 0}</td><td>${r?.approved ? '✓ Aprobado' : r ? '✗ Por mejorar' : 'Sin presentar'}</td></tr>`;
      }).join('')}
      </tbody></table>
      <p class="sim-help">Esta es una práctica libre: no cuenta como evaluación oficial y puedes repetirla cuando quieras.</p>`,
  });
}

/**
 * En la prueba, la zona de «Información Personal» muestra la llamada: el audio y lo mínimo del deudor para tipificar
 * (nombre, identificación, teléfono marcado y saldo). MP3 primero (suena en cualquier navegador) y Opus de respaldo.
 */
export function callCardTemplate(exercise: Exercise, v: CustomerView): string {
  return `
    <div class="sim-call-card" data-sim-guide="prueba.audio">
      <div class="sim-call-card__player">
        <p class="sim-call-card__title">${icon('Headphones')} Llamada del ejercicio ${exercise.number}: ${esc(exercise.title)}</p>
        <audio controls preload="metadata" data-call-audio>
          <source src="${esc(exercise.audio)}.mp3" type="audio/mpeg" />
          <source src="${esc(exercise.audio)}.ogg" type="audio/ogg; codecs=opus" />
          Tu navegador no reproduce el audio.
        </audio>
        <ol class="sim-call-card__steps">
          <li>Escucha la llamada completa (sube el volumen de tu equipo).</li>
          <li>Tipifícala abajo en <strong>«Nueva Gestión»</strong>: acción, contacto, canal, perfil, motivo, teléfono y la gestión escrita.</li>
          <li>Pulsa <strong>«Guardar»</strong>: el sistema experto revisa tu tipificación y llena los checkmarks.</li>
        </ol>
      </div>
      <dl class="sim-call-card__data">
        <div><dt>Nombre</dt><dd>${esc(v.name.toUpperCase())}</dd></div>
        <div><dt>Identificación</dt><dd>${esc(v.document)}</dd></div>
        <div><dt>Teléfono marcado</dt><dd>${esc(v.phone.replace(/\s/g, ''))}</dd></div>
        <div><dt>Saldo total</dt><dd>${esc(formatCOP(v.totalBalance))}</dd></div>
      </dl>
    </div>`;
}

const nextButton = (isLast: boolean, size = ''): string =>
  `<button type="button" class="sim-btn sim-btn--primary${size}" data-practice="next">${isLast ? `${icon('Check')} Ver resultados` : `Siguiente ejercicio ${icon('ArrowRight')}`}</button>`;

/** Qué puede hacer el asesor con un ejercicio oficial ya entregado y no aprobado. */
function officialNextStep(official: OfficialExercise | null | undefined): string {
  if (!official || official.status === 'APROBADO') return '';
  if (official.status === 'REACTIVACION_SOLICITADA') return '<p class="sim-expert-result__note">Tu solicitud de reactivación está pendiente: el administrador la revisará.</p>';
  if (official.canSubmit) return '<p class="sim-expert-result__note">El administrador autorizó un nuevo intento: corrige tu tipificación y guárdala.</p>';
  return `<div class="sim-expert-result__note">
      <p><strong>Actividad no aprobada.</strong> Has finalizado tu intento de evaluación. Para volver a presentar esta actividad necesitas una autorización del administrador.</p>
      <button type="button" class="sim-btn sim-btn--secondary sim-btn--sm" data-practice="reactivate">${icon('Mail')} Solicitar reactivación</button>
    </div>`;
}

/** Resultado del sistema experto junto al formulario «Nueva Gestión». */
function resultTemplate(evaluation: Evaluation, isLast: boolean, attempts: number, official?: OfficialExercise | null): string {
  const missing = evaluation.items.filter((i) => !i.ok);
  const head = official
    ? `Resultado oficial guardado: ${evaluation.approved ? `aprobado (${evaluation.score} %)` : `${evaluation.passed} de ${evaluation.total} puntos (${evaluation.score} %) · no aprobado`}`
    : `Sistema experto: ${evaluation.approved ? `tipificación correcta (${evaluation.score} %)` : `${evaluation.passed} de ${evaluation.total} puntos (${evaluation.score} %) · intento ${attempts}`}`;
  return `
    <div class="sim-expert-result ${evaluation.approved ? 'is-ok' : 'is-bad'}" role="status">
      <p class="sim-expert-result__title">${icon(evaluation.approved ? 'CircleCheck' : 'TriangleAlert')} ${esc(head)}</p>
      ${missing.length ? `<ul class="sim-expert-result__list">${missing.map((i) => `<li><strong>✗ ${esc(i.label)}.</strong> ${esc(i.detail)}</li>`).join('')}</ul>` : '<p>Cumpliste todos los puntos de esta llamada.</p>'}
      ${official ? officialNextStep(official) : ''}
      <div class="sim-expert-result__actions">
        <button type="button" class="sim-btn sim-btn--ghost sim-btn--sm" data-practice="checks">${icon('ClipboardList')} Ver los checkmarks</button>
        ${evaluation.approved || official ? '' : `<button type="button" class="sim-btn sim-btn--ghost sim-btn--sm" data-practice="retry">${icon('RotateCcw')} Intentar de nuevo</button>`}
        ${nextButton(isLast, ' sim-btn--sm')}
      </div>
    </div>`;
}

function scoreLine(evaluation: Evaluation, official: OfficialExercise | null | undefined, attempts: number): string {
  if (evaluation.approved) return `<strong class="is-ok">✓ Tipificación correcta (${evaluation.score} %).</strong> Pasa al siguiente ejercicio.`;
  const base = `<strong class="is-bad">${evaluation.passed} de ${evaluation.total} puntos (${evaluation.score} %).</strong>`;
  return official ? `${base} Tu intento oficial quedó registrado.` : `${base} Revisa lo marcado con ✗ e inténtalo de nuevo. Intento ${attempts}.`;
}

export function mountPracticePanel(host: HTMLElement, ctx: SimContext, exercise: Exercise, opts: { onRetry(): void; resultSlot: HTMLElement }): PracticePanel {
  const isLast = exercise.number === EXERCISES.length;
  const draw = (): void => {
    const official = isOfficial();
    host.innerHTML = `
      <section class="sim-card sim-practice" data-sim-guide="prueba.panel" aria-labelledby="sim-practice-title">
        <header class="sim-practice__head">
          <div>
            <p class="sim-practice__kicker">${icon('ClipboardList')} ${official ? 'Prueba oficial' : 'Práctica'} de tipificación · Ejercicio ${exercise.number} de ${EXERCISES.length}</p>
            <h2 id="sim-practice-title" class="sim-practice__title">${esc(exercise.title)}</h2>
            <p class="sim-practice__brief">${esc(exercise.brief)} La llamada está abajo, donde va la información del deudor; tipifícala en «Nueva Gestión» y pulsa «Guardar».${official ? ' <strong>Tienes un solo intento:</strong> revisa bien antes de guardar.' : ''}</p>
          </div>
          <ol class="sim-practice__steps" aria-label="Avance de la prueba" data-progress>${progressTemplate(ctx, exercise)}</ol>
        </header>
        <div class="sim-practice__checks" data-sim-guide="prueba.checks">
          <p class="sim-practice__subtitle">Lo que debe tener esta tipificación</p>
          <ol class="sim-check-list" data-checks>${checklistTemplate(exercise)}</ol>
        </div>
        <footer class="sim-practice__foot">
          <p class="sim-practice__score" data-score aria-live="polite">Escucha el audio completo antes de tipificar.</p>
          <div class="sim-practice__actions">
            <button type="button" class="sim-btn sim-btn--ghost" data-practice="retry" hidden>${icon('RotateCcw')} Intentar de nuevo</button>
            ${nextButton(isLast)}
          </div>
        </footer>
      </section>`;
    hydrateIcons(host);
  };
  draw();

  const checks = (): HTMLElement => qs(host, '[data-checks]');
  const score = (): HTMLElement => qs(host, '[data-score]');
  let shown: Evaluation | null = null;

  const render = (evaluation: Evaluation, officialInfo: OfficialExercise | null | undefined, attempts: number): void => {
    shown = evaluation;
    checks().innerHTML = checklistTemplate(exercise, evaluation);
    qs(host, '[data-progress]').innerHTML = progressTemplate(ctx, exercise);
    score().innerHTML = scoreLine(evaluation, officialInfo, attempts);
    qs<HTMLElement>(host, '[data-practice="retry"]').hidden = evaluation.approved || Boolean(officialInfo);
    // El resultado aparece junto al formulario, donde el asesor está mirando.
    opts.resultSlot.innerHTML = resultTemplate(evaluation, isLast, attempts, officialInfo);
    hydrateIcons(opts.resultSlot);
  };

  // Ejercicio oficial ya entregado: se muestra su resultado guardado en el servidor.
  const showSaved = (): void => {
    const saved = isOfficial() ? officialExercise(exercise.number) : null;
    if (saved?.result && !saved.canSubmit) render(toEvaluation(saved.result), saved, 1);
  };
  showSaved();

  return {
    showEvaluation(evaluation, officialInfo) {
      const attempts = officialInfo ? 1 : ctx.store.recordPractice(exercise.id, evaluation.score, evaluation.approved).attempts;
      render(evaluation, officialInfo, attempts);
      opts.resultSlot.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },
    refreshOfficial() {
      if (shown) return;
      draw();
      showSaved();
    },
    cleanup: combine([
      () => {
        host.innerHTML = '';
        opts.resultSlot.innerHTML = '';
      },
      ...[host, opts.resultSlot].map((el) => on(el, 'click', (event) => {
        const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-practice]');
        const action = button?.dataset.practice;
        if (action === 'retry') {
          checks().innerHTML = checklistTemplate(exercise);
          score().textContent = 'Corrige la tipificación y vuelve a guardar.';
          opts.resultSlot.innerHTML = '';
          opts.onRetry();
        } else if (action === 'checks') {
          host.querySelector('.sim-practice')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        } else if (action === 'reactivate' && button) {
          button.disabled = true;
          requestOfficialReactivation(exercise.number)
            .then(() => {
              ctx.toast('Solicitud enviada. El administrador la revisará.', 'success');
              if (shown) render(shown, officialExercise(exercise.number), 1);
            })
            .catch((error: Error) => {
              button.disabled = false;
              ctx.toast(error.message, 'error');
            });
        } else if (action === 'next') {
          if (isLast) void showSummary(ctx);
          else ctx.navigate(`/cartera/${EXERCISE_PORTFOLIO}/cliente/${EXERCISES[exercise.number]!.customer.id}`);
        }
      })),
    ]),
  };
}

/** Lleva al primer ejercicio sin aprobar (o al primero) y activa la prueba. */
export function startPractice(ctx: SimContext, restart = false): void {
  ctx.store.startPractice(restart);
  const official = isOfficial() ? officialState() : null;
  const results = ctx.store.get().practice.results;
  const next = official
    ? EXERCISES.find((e) => officialExercise(e.number)?.canSubmit) ?? EXERCISES.find((e) => officialExercise(e.number)?.status !== 'APROBADO') ?? EXERCISES[0]!
    : EXERCISES.find((e) => !results[e.id]?.approved) ?? EXERCISES[0]!;
  ctx.navigate(`/cartera/${EXERCISE_PORTFOLIO}/cliente/${next.customer.id}`);
}
