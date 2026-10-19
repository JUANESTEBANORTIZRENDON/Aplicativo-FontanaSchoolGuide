import { api, escapar, formatDate } from '../http.js';
import type { ExamCoaching, StoredExamResult } from '../../server/domain/collections-exam-report.js';

type Advisor = { id: string; name: string; document: string };
type AttemptSummary = { id: string; attempt: number; submittedAt: string; version: number | null; score: number | null; verdict: string | null; detailAvailable: boolean; sections: { key: string; title: string; score: number; maxScore: number }[] };
type HistoryPage = { advisor: Advisor; items: AttemptSummary[]; total: number; nextCursor: string | null; legacyNotice: string | null };
type AttemptDetail = AttemptSummary & { advisor: Advisor; result: StoredExamResult | null; coaching: ExamCoaching | null; coachingSaved: boolean };
const verdictHtml = (verdict: string | null) => `<span class="status status-${verdict === 'Apto' ? 'passed' : verdict ? 'failed' : 'not_started'}">${escapar(verdict ?? 'Sin detalle histórico')}</span>`;

export function examAttemptHtml(detail: AttemptDetail): string {
  const result = detail.result;
  if (!result || !detail.coaching) return '<p class="dialog-note">Este registro no contiene un resultado completo de siete secciones. Se conserva el registro original; no se ha recalculado ni supuesto un puntaje.</p>';
  const coaching = detail.coaching;
  return `<header class="collections-admin-report-head"><div><p>INFORME INDIVIDUAL · INTENTO ${detail.attempt}</p><h3>${escapar(detail.advisor.name)}</h3><span>${escapar(formatDate(detail.submittedAt))} · Evaluación v${result.version}</span></div><div><strong>${result.score}/100</strong>${verdictHtml(result.verdict)}</div></header>
    <div class="table-wrap"><table class="collections-admin-scores"><caption>Desempeño en las 7 secciones</caption><thead><tr><th scope="col">Sección</th><th scope="col">Puntaje</th><th scope="col">Desempeño</th></tr></thead><tbody>${result.sections.map((section) => `<tr><th scope="row">${escapar(section.title)}</th><td>${section.score}/${section.maxScore}</td><td><span class="bar" role="progressbar" aria-label="${escapar(section.title)}" aria-valuenow="${section.score}" aria-valuemin="0" aria-valuemax="${section.maxScore}"><span style="width:${Math.round(section.score / section.maxScore * 100)}%"></span></span></td></tr>`).join('')}</tbody></table></div>
    ${result.criticalErrors.length ? `<section class="collections-admin-critical"><h4>Atender primero · Errores críticos</h4><ul>${result.criticalErrors.map((item) => `<li><strong>${escapar(item.section)}:</strong> ${escapar(item.reason)}</li>`).join('')}</ul></section>` : ''}
    <div class="collections-admin-coaching"><section><h4>Fortalezas demostradas <span>${coaching.strengths.length}</span></h4>${coaching.strengths.length ? result.sections.map((section) => {
      const items = coaching.strengths.filter((item) => item.section === section.title);
      return items.length ? `<details class="collections-admin-skill"><summary>${escapar(section.title)} · ${items.length}</summary><ul>${items.map((item) => `<li><strong>${escapar(item.description)}</strong><blockquote>Su respuesta: ${escapar(item.evidence)}</blockquote></li>`).join('')}</ul></details>` : '';
    }).join('') : '<p>No hubo respuestas con logros suficientes para destacar. Revisar primero los aspectos de refuerzo.</p>'}</section>
    <section><h4>Refuerzo recomendado <span>${coaching.improvements.length}</span></h4>${coaching.improvements.length ? coaching.improvements.map((item) => `<details class="collections-admin-skill${item.priority === 'critical' ? ' is-critical' : ''}"${item.priority === 'critical' ? ' open' : ''}><summary>${item.priority === 'critical' ? 'Prioritario · ' : ''}${escapar(item.section)}</summary><p><strong>Qué mejorar:</strong> ${escapar(item.description)}</p><blockquote>Su respuesta: ${escapar(item.evidence)}</blockquote><p class="collections-admin-action"><strong>Actividad de refuerzo:</strong> ${escapar(item.recommendation)}</p></details>`).join('') : '<p>No se identificaron aspectos de refuerzo en las respuestas de este intento. Validar la aplicación práctica con el líder.</p>'}</section></div>
    <details class="collections-admin-responses"><summary>Consultar respuestas y criterios del intento</summary>${result.sections.map((section) => `<h4>${escapar(section.title)}</h4>${section.results.map((q) => `<article><p><strong>${escapar(q.prompt ?? q.key)}</strong></p><p>Respuesta: ${escapar(q.selectedText ?? coaching.strengths.find((s) => s.key === q.key)?.evidence ?? coaching.improvements.find((s) => s.key === q.key)?.evidence ?? q.selected)}</p><p>Puntaje: ${q.points}/${q.maxPoints}. ${escapar(q.feedback)}</p>${q.criteria.length ? `<ul>${q.criteria.map((c) => `<li>${c.met ? '✓' : 'Pendiente:'} ${escapar(c.label)}</li>`).join('')}</ul>` : ''}<p>Referencia de evaluación: ${escapar(q.expected)}</p></article>`).join('')}`).join('')}</details>
    <p class="dialog-note">Informe formativo basado en las respuestas guardadas de este intento. La redacción usa criterios automáticos básicos y requiere revisión del líder. ${detail.coachingSaved ? 'Las recomendaciones se conservaron al enviar la evaluación.' : 'Las recomendaciones de este registro anterior se construyen a partir de sus resultados guardados.'}</p>`;
}

export async function mountCollectionsHistory(root: HTMLElement, userId: string): Promise<void> {
  let page: HistoryPage;
  let items: AttemptSummary[] = [];
  let selected: AttemptDetail | null = null;
  const cache = new Map<string, AttemptDetail>();
  let loading = false;
  let detailLoading = false;
  let error = '';
  let detailRequest = 0;
  const base = `/admin/advisors/${encodeURIComponent(userId)}/collections-exams`;
  root.innerHTML = '<p class="loading-note" role="status">Cargando resultados de cobranzas…</p>';

  function render(): void {
    if (!root.isConnected) return;
    const latest = items[0]; const previous = items[1];
    const comparable = latest?.score !== null && latest?.score !== undefined && previous?.score !== null && previous?.score !== undefined && latest.version === previous.version;
    const change = comparable ? latest.score! - previous.score! : null;
    root.innerHTML = `<section class="auth-card admin-card collections-admin-history"><div class="section-title"><div><h2>Examen final de cobranzas</h2><p>${escapar(page.advisor.name)} · Historial individual de evaluaciones</p></div></div>
      <div class="metric-cards"><div class="metric-card"><span>Intentos registrados</span><strong>${page.total}</strong></div><div class="metric-card"><span>Último puntaje</span><strong>${latest?.score === null || !latest ? '—' : `${latest.score}/100`}</strong></div><div class="metric-card"><span>Último resultado</span>${verdictHtml(latest?.verdict ?? null)}${change !== null ? `<small>${change > 0 ? '+' : ''}${change} puntos respecto al intento anterior.</small>` : '<small>La comparación requiere dos intentos de la misma versión.</small>'}</div></div>
      ${page.legacyNotice ? `<p class="dialog-note">${escapar(page.legacyNotice)}</p>` : ''}
      <div class="table-wrap"><table><caption>Intentos enviados · Más recientes primero</caption><thead><tr><th scope="col">Intento</th><th scope="col">Fecha</th><th scope="col">Puntaje</th><th scope="col">Resultado</th><th scope="col">Informe</th></tr></thead><tbody>${items.map((attempt) => `<tr${selected?.id === attempt.id ? ' class="is-selected"' : ''}><th scope="row">#${attempt.attempt}</th><td>${escapar(formatDate(attempt.submittedAt))}</td><td>${attempt.score === null ? '—' : `${attempt.score}/100`}</td><td>${verdictHtml(attempt.verdict)}</td><td><button type="button" class="row-action" data-collections-attempt="${escapar(attempt.id)}" aria-controls="collections-admin-detail" aria-pressed="${selected?.id === attempt.id}">${selected?.id === attempt.id ? 'Informe abierto' : 'Ver informe'}</button></td></tr>`).join('') || '<tr><td colspan="5">Este asesor aún no tiene intentos detallados registrados.</td></tr>'}</tbody></table></div>
      ${page.nextCursor ? `<button type="button" class="row-action" data-collections-more${loading ? ' disabled' : ''}>${loading ? 'Cargando…' : 'Cargar intentos anteriores'}</button>` : ''}
      ${error ? `<p class="dialog-error" role="alert">${escapar(error)}</p>` : ''}
      <div id="collections-admin-detail" class="collections-admin-detail" tabindex="-1" aria-busy="${detailLoading}">${detailLoading ? '<p role="status">Cargando informe…</p>' : selected ? examAttemptHtml(selected) : ''}</div></section>`;
  }
  async function openAttempt(id: string, moveFocus = true): Promise<void> {
    const request = ++detailRequest;
    detailLoading = true; error = ''; render();
    try {
      const detail = cache.get(id) ?? (await api<{ data: AttemptDetail }>(`${base}/${encodeURIComponent(id)}`)).data;
      if (request !== detailRequest || !root.isConnected) return;
      cache.set(id, detail); selected = detail;
    } catch (cause) { if (request === detailRequest) error = (cause as Error).message; }
    if (request !== detailRequest) return;
    detailLoading = false; render();
    if (moveFocus) root.querySelector<HTMLElement>('#collections-admin-detail')?.focus();
  }
  try {
    page = (await api<{ data: HistoryPage }>(base)).data; items = page.items; render();
    if (items[0]) void openAttempt(items[0].id, false);
  } catch (cause) {
    root.innerHTML = `<section class="auth-card admin-card"><h2>Examen final de cobranzas</h2><p class="dialog-error" role="alert">${escapar((cause as Error).message)}</p></section>`;
    return;
  }
  root.addEventListener('click', async (event) => {
    const target = event.target as HTMLElement;
    const attempt = target.closest<HTMLButtonElement>('[data-collections-attempt]');
    if (attempt) { await openAttempt(attempt.dataset.collectionsAttempt!); return; }
    if (!target.closest('[data-collections-more]') || loading || !page.nextCursor) return;
    loading = true; error = ''; render();
    try {
      const next = (await api<{ data: HistoryPage }>(`${base}?cursor=${encodeURIComponent(page.nextCursor)}`)).data;
      page = { ...next, legacyNotice: page.legacyNotice };
      const existing = new Set(items.map((item) => item.id)); items.push(...next.items.filter((item) => !existing.has(item.id)));
    } catch (cause) { error = (cause as Error).message; }
    loading = false; render();
  });
}
