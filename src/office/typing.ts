import { escapar } from '../http';
import { ApiError, officeApi, type TypingPrepared, type TypingResult } from './api';
import { errorMessage, showError, type OfficeContext } from './office';

// Prueba de mecanografía propia. El navegador solo muestra el texto, el temporizador y un avance
// provisional; las métricas que cuentan las calcula el servidor al cerrar el intento.

const BLOCKED_INPUT = ['insertFromPaste', 'insertFromDrop', 'insertReplacementText'];

// Sin copiar, pegar, arrastrar ni menú contextual: la prueba mide escritura, no copiado.
function lockPasting(element: HTMLElement): void {
  for (const type of ['paste', 'cut', 'copy', 'drop', 'dragstart', 'contextmenu']) element.addEventListener(type, (event) => event.preventDefault());
  element.addEventListener('beforeinput', (event) => {
    if (BLOCKED_INPUT.includes((event as InputEvent).inputType)) event.preventDefault();
  });
}

function textareaHtml(id: string, label: string): string {
  return `<label class="office-label" for="${id}">${escapar(label)}</label>
    <textarea id="${id}" class="office-typing-input" rows="7" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" disabled></textarea>`;
}

// Repaso de la prueba: qué mide y cómo se aprueba, para volver a leerlo cuando ya terminó.
function reviewHtml(cfg: OfficeContext['state']['config']['typing']): string {
  return `<details class="office-review"><summary>Repasar en qué consiste la prueba</summary>
    <ul class="office-goals">
      <li><strong>Duración:</strong> ${cfg.durationSeconds} segundos copiando un texto de atención al cliente.</li>
      <li><strong>Meta:</strong> ${cfg.minCorrectCpm} caracteres correctos por minuto (${Math.round(cfg.minCorrectCpm / 5)} palabras por minuto).</li>
      <li><strong>Precisión mínima:</strong> ${cfg.minAccuracy} %. Cada espacio, tilde y signo cuenta.</li>
      <li><strong>Reglas:</strong> no se puede pegar ni copiar, y salir durante la prueba cuenta como intento fallido.</li>
    </ul></details>`;
}

export function renderTyping(ctx: OfficeContext): void {
  const { state } = ctx;
  const section = state.sections.find((item) => item.key === 'mecanografia')!;
  const cfg = state.config.typing;
  if (section.status === 'COMPLETED') {
    ctx.view.innerHTML = `
      <section class="office-card">
        <p class="eyebrow">MECANOGRAFÍA</p><h1>Mecanografía aprobada</h1>
        <p class="office-lead">Ya cumpliste la meta de ${cfg.minCorrectCpm} caracteres correctos por minuto con ${cfg.minAccuracy} % de precisión.</p>
        ${reviewHtml(cfg)}
        <div class="office-actions"><button class="primary" id="typing-next" type="button">Continuar con Excel →</button></div>
      </section>`;
    ctx.view.querySelector('#typing-next')!.addEventListener('click', () => ctx.go('excel'));
    return;
  }
  if (section.status === 'NO_ATTEMPTS') {
    ctx.view.innerHTML = `
      <section class="office-card">
        <p class="eyebrow">MECANOGRAFÍA</p><h1>Sin intentos disponibles</h1>
        <p class="office-error">Agotaste los intentos de la prueba. Solicita una reactivación al administrador para continuar.</p>
        ${reviewHtml(cfg)}
        <a class="office-secondary" href="${escapar(ctx.backHref)}">Volver a tu ruta de formación</a>
      </section>`;
    return;
  }
  if (state.typing.practiceRequired) { void renderPractice(ctx); return; }
  renderIntro(ctx);
}

function renderIntro(ctx: OfficeContext): void {
  const { state } = ctx;
  const cfg = state.config.typing;
  const section = state.sections.find((item) => item.key === 'mecanografia')!;
  const open = state.typing.openAttempt;
  ctx.view.innerHTML = `
    <section class="office-card" aria-labelledby="typing-title">
      <p class="eyebrow">MECANOGRAFÍA · ${cfg.durationSeconds} SEGUNDOS</p>
      <h1 id="typing-title">Escribe con rapidez y precisión</h1>
      <p class="office-lead">Vas a copiar un texto de atención al cliente durante ${cfg.durationSeconds} segundos. Cada espacio, tilde y signo cuenta.</p>
      <ul class="office-goals">
        <li><strong>Meta:</strong> ${cfg.minCorrectCpm} caracteres correctos por minuto (${Math.round(cfg.minCorrectCpm / 5)} palabras por minuto).</li>
        <li><strong>Precisión mínima:</strong> ${cfg.minAccuracy} %.</li>
        <li><strong>Intentos:</strong> te quedan ${section.attemptsRemaining ?? cfg.maxAttempts} de ${section.maxAttempts ?? cfg.maxAttempts}.</li>
      </ul>
      <p class="office-warning" role="note"><strong>Antes de iniciar:</strong> no recargues la página ni salgas durante la prueba. Si la abandonas, el intento se cuenta como fallido. Pegar y copiar están desactivados.</p>
      ${open ? `<p class="office-error" role="alert">Tienes una prueba preparada o en curso que ya no se puede retomar. Podrás preparar otra cuando venza (${escapar(new Intl.DateTimeFormat('es-CO', { timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(open.expiresAt)))}).</p>` : ''}
      <div class="office-actions">
        <button class="primary" id="typing-prepare" type="button">Preparar mi prueba</button>
        ${open ? '<button class="office-secondary" id="typing-refresh" type="button">Actualizar estado</button>' : ''}
      </div>
    </section>`;
  const prepare = ctx.view.querySelector<HTMLButtonElement>('#typing-prepare')!;
  prepare.addEventListener('click', async () => {
    prepare.disabled = true;
    prepare.textContent = 'Preparando…';
    try {
      renderReady(ctx, await officeApi.typingPrepare());
    } catch (error) {
      prepare.disabled = false;
      prepare.textContent = 'Preparar mi prueba';
      if (error instanceof ApiError && error.code === 'PRACTICE_REQUIRED') { await ctx.reload(); return; }
      showError(ctx.view, error);
    }
  });
  ctx.view.querySelector('#typing-refresh')?.addEventListener('click', () => void ctx.reload());
}

function renderReady(ctx: OfficeContext, prepared: TypingPrepared): void {
  ctx.view.innerHTML = `
    <section class="office-card" aria-labelledby="typing-title">
      <p class="eyebrow">MECANOGRAFÍA · INTENTO ${prepared.number}</p>
      <h1 id="typing-title">${escapar(prepared.textTitle)}</h1>
      <p class="office-lead">Lee el texto con calma. Cuando pulses «Iniciar prueba» podrás escribir; el cronómetro empieza con tu primera tecla (o en ${prepared.startWindowSeconds} segundos).</p>
      <div class="office-typing-meta" aria-live="off">
        <output id="typing-timer" class="office-timer">${String(prepared.durationSeconds).padStart(2, '0')} s</output>
        <span id="typing-status">Listo para empezar</span>
        <span id="typing-correct">0 caracteres correctos</span>
      </div>
      <p id="typing-target" class="office-typing-target" aria-label="Texto para copiar"></p>
      ${textareaHtml('typing-input', 'Escribe aquí el texto')}
      <p id="typing-note" class="office-note" role="status"></p>
      <div class="office-actions"><button class="primary" id="typing-begin" type="button">Iniciar prueba</button></div>
    </section>`;
  const target = prepared.text;
  const targetEl = ctx.view.querySelector<HTMLElement>('#typing-target')!;
  const input = ctx.view.querySelector<HTMLTextAreaElement>('#typing-input')!;
  const timer = ctx.view.querySelector<HTMLOutputElement>('#typing-timer')!;
  const status = ctx.view.querySelector<HTMLElement>('#typing-status')!;
  const correct = ctx.view.querySelector<HTMLElement>('#typing-correct')!;
  const begin = ctx.view.querySelector<HTMLButtonElement>('#typing-begin')!;

  // Texto objetivo: un span por carácter para marcar lo correcto y lo equivocado (solo visual).
  const chars = [...target];
  targetEl.replaceChildren(...chars.map((char) => { const span = document.createElement('span'); span.textContent = char; return span; }));
  const spans = [...targetEl.children] as HTMLElement[];
  lockPasting(targetEl);
  lockPasting(input);

  function paint(typed: string): void {
    const typedChars = [...typed];
    let ok = 0;
    spans.forEach((span, index) => {
      const written = typedChars[index];
      span.className = written === undefined ? (index === typedChars.length ? 'is-current' : '') : written === chars[index] ? 'is-ok' : 'is-bad';
      if (written === chars[index]) ok += 1;
    });
    correct.textContent = `${ok} caracteres correctos`;
  }
  paint('');

  let running = false;
  let finished = false;
  begin.addEventListener('click', async () => {
    if (running) return;
    running = true;
    begin.disabled = true;
    begin.textContent = 'Iniciando…';
    try {
      const started = await officeApi.typingStart(prepared.attemptId);
      begin.hidden = true;
      beginRun(started.durationSeconds, started.startWindowSeconds);
    } catch (error) {
      running = false;
      begin.disabled = false;
      begin.textContent = 'Iniciar prueba';
      if (error instanceof ApiError && (error.code === 'TYPING_ATTEMPT_EXPIRED' || error.code === 'ATTEMPT_CLOSED')) { await ctx.reload(); return; }
      showError(ctx.view, error);
    }
  });

  function beginRun(durationSeconds: number, windowSeconds: number): void {
    const officialStart = performance.now();
    let timerStart: number | null = null;
    input.disabled = false;
    input.focus();
    status.textContent = `Empieza a escribir: tienes ${windowSeconds} s para la primera tecla`;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', beforeUnload);

    const finish = async () => {
      if (finished) return;
      finished = true;
      window.clearInterval(interval);
      window.removeEventListener('beforeunload', beforeUnload);
      input.readOnly = true;
      input.disabled = false;
      status.textContent = 'Tiempo terminado. Enviando tu resultado…';
      const elapsed = timerStart === null ? 0 : (performance.now() - timerStart) / 1000;
      try {
        const result = await officeApi.typingComplete(prepared.attemptId, { nonce: prepared.nonce, typedText: input.value, clientDurationSeconds: Math.min(3600, elapsed) });
        renderResult(ctx, result);
      } catch (error) {
        const closed = error instanceof ApiError && ['TYPING_TIME_EXPIRED', 'ATTEMPT_CLOSED', 'NONCE_INVALID'].includes(error.code ?? '');
        ctx.view.innerHTML = `<section class="office-card"><p class="eyebrow">MECANOGRAFÍA</p><h1>No pudimos registrar la prueba</h1><p class="office-error" role="alert">${escapar(errorMessage(error))}</p><div class="office-actions"><button class="primary" id="typing-back" type="button">${closed ? 'Volver al inicio de la prueba' : 'Reintentar el envío'}</button></div></section>`;
        ctx.view.querySelector('#typing-back')!.addEventListener('click', () => void ctx.reload());
      }
    };

    const tick = () => {
      const now = performance.now();
      if (timerStart === null) {
        const left = windowSeconds - (now - officialStart) / 1000;
        if (left <= 0) { timerStart = now; status.textContent = 'Escribiendo…'; } else { status.textContent = `Empieza a escribir. El tiempo comienza en ${Math.ceil(left)} s`; return; }
      }
      const remaining = durationSeconds - (now - timerStart) / 1000;
      timer.textContent = `${String(Math.max(0, Math.ceil(remaining))).padStart(2, '0')} s`;
      if (remaining <= 0) void finish();
    };
    const interval = window.setInterval(tick, 100);
    input.addEventListener('input', () => {
      if (finished) return;
      if (timerStart === null) { timerStart = performance.now(); status.textContent = 'Escribiendo…'; }
      paint(input.value);
    });
  }
}

function renderResult(ctx: OfficeContext, result: TypingResult): void {
  const m = result.metrics;
  const cfg = ctx.state.config.typing;
  ctx.view.innerHTML = `
    <section class="office-card" aria-labelledby="typing-result-title">
      <p class="eyebrow">MECANOGRAFÍA · INTENTO ${result.attemptNumber}</p>
      <h1 id="typing-result-title">${result.passed ? '¡Prueba aprobada!' : 'Todavía no alcanzas la meta'}</h1>
      <div class="office-metrics">
        <div><strong>${m.correctCpm}</strong><span>caracteres correctos por minuto</span><small>Meta: ${cfg.minCorrectCpm}</small></div>
        <div><strong>${m.ppm.toFixed(1)}</strong><span>palabras por minuto</span><small>Meta: ${(cfg.minCorrectCpm / 5).toFixed(0)}</small></div>
        <div><strong>${m.accuracy.toFixed(2)} %</strong><span>precisión</span><small>Meta: ${cfg.minAccuracy} %</small></div>
        <div><strong>${m.errors}</strong><span>errores</span><small>${m.correctCharacters} de ${m.totalCharacters} caracteres correctos</small></div>
      </div>
      ${result.passed
        ? '<p class="office-note">Muy bien. Sigue con la práctica de Excel.</p>'
        : result.attemptsRemaining
          ? `<p class="office-note">Te quedan ${result.attemptsRemaining} intento(s). Antes de repetir haz una práctica breve: no cuenta como intento.</p>`
          : '<p class="office-error">Agotaste los intentos. Solicita una reactivación al administrador.</p>'}
      <div class="office-actions">
        ${result.passed ? '<button class="primary" id="typing-next" type="button">Continuar con Excel →</button>'
          : result.attemptsRemaining ? '<button class="primary" id="typing-practice" type="button">Hacer la práctica breve</button>' : ''}
      </div>
    </section>`;
  ctx.view.querySelector('#typing-next')?.addEventListener('click', async () => { await ctx.refresh().catch(() => undefined); ctx.go('excel'); });
  ctx.view.querySelector('#typing-practice')?.addEventListener('click', () => void ctx.reload());
}

// Práctica breve obligatoria tras fallar: un texto corto que no se guarda como intento.
async function renderPractice(ctx: OfficeContext): Promise<void> {
  const { texts } = await officeApi.typingPracticeTexts();
  const text = texts[Math.floor(Math.random() * texts.length)] ?? 'Gracias por su tiempo y por su atención.';
  ctx.view.innerHTML = `
    <section class="office-card" aria-labelledby="practice-title">
      <p class="eyebrow">MECANOGRAFÍA · PRÁCTICA BREVE</p>
      <h1 id="practice-title">Practica antes de repetir</h1>
      <p class="office-lead">Copia este texto sin prisa. No cuenta como intento: es para que entres en ritmo.</p>
      <p class="office-typing-target" aria-label="Texto de práctica" id="practice-target"></p>
      ${textareaHtml('practice-input', 'Escribe aquí la práctica')}
      <p id="practice-progress" class="office-note" role="status">Escribe el texto completo para continuar.</p>
      <div class="office-actions"><button class="primary" id="practice-done" type="button" disabled>Terminé la práctica</button></div>
    </section>`;
  ctx.view.querySelector<HTMLElement>('#practice-target')!.textContent = text;
  lockPasting(ctx.view.querySelector<HTMLElement>('#practice-target')!);
  const input = ctx.view.querySelector<HTMLTextAreaElement>('#practice-input')!;
  const done = ctx.view.querySelector<HTMLButtonElement>('#practice-done')!;
  const progress = ctx.view.querySelector<HTMLElement>('#practice-progress')!;
  input.disabled = false;
  lockPasting(input);
  input.addEventListener('input', () => {
    const ratio = Math.min(100, Math.round((input.value.length / text.length) * 100));
    progress.textContent = ratio >= 80 ? 'Muy bien. Ya puedes continuar.' : `Llevas el ${ratio} % del texto.`;
    done.disabled = ratio < 80;
  });
  done.addEventListener('click', async () => {
    done.disabled = true;
    try {
      await officeApi.typingPracticeDone();
      await ctx.reload();
    } catch (error) {
      done.disabled = false;
      showError(ctx.view, error);
    }
  });
}
