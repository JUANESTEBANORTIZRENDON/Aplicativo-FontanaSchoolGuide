import { escapar } from '../http';
import { icon } from './concepts-slider';
import {
  AGENCY, PORTFOLIO, QUALITY_NOTICE, CLIENT_REPLY, CONSULTATION_SCRIPT, GUIDED_BLOCKS,
  QUALITY_ANSWERS, ALTERNATIVE_ANSWERS, CLOSURE_ANSWERS, OUTCOMES,
  advanceGuidedCase, caseGreeting, casePresentation, caseInformation, caseNote,
  type GuidedCaseState, type GuidedBlockKey, type GuidedStepKey, type DraftField,
} from './guided-case-model';

type Options = { block: GuidedBlockKey; onContinue: () => void; saving: boolean; error: string };

export function mountGuidedCase(root: HTMLElement, state: GuidedCaseState, options: Options): void {
  const guide = GUIDED_BLOCKS[options.block];
  const progress = state.progress[options.block];
  let feedback = '';
  function focus(selector: string): void { root.querySelector<HTMLElement>(selector)?.focus(); }
  function input(name: DraftField, label: string, placeholder: string, extra = ''): string {
    return `<label class="collections-plan-field" for="case-${name}">${label}<input id="case-${name}" data-case-field="${name}" value="${escapar(state[name])}" placeholder="${placeholder}" required maxlength="80" ${extra}></label>`;
  }
  function textarea(name: DraftField, label: string, placeholder: string): string {
    return `<label class="collections-plan-field" for="case-${name}">${label}<textarea id="case-${name}" data-case-field="${name}" required minlength="8" maxlength="500" rows="3" placeholder="${placeholder}">${escapar(state[name])}</textarea></label>`;
  }
  function select(name: DraftField, label: string, choices: { value: string; text: string }[]): string {
    return `<label class="collections-plan-field" for="case-${name}">${label}<select id="case-${name}" data-case-field="${name}" required><option value="">Elige una respuesta</option>${choices.map((choice) => `<option value="${choice.value}"${state[name] === choice.value ? ' selected' : ''}>${escapar(choice.text)}</option>`).join('')}</select></label>`;
  }
  const script = (text: string, preview = false) => `<blockquote class="collections-plan-script"${preview ? ' data-case-preview' : ''}>${escapar(text)}</blockquote>`;
  const reply = (text = CLIENT_REPLY) => `<div class="collections-plan-reply"><span>CAMILA RESPONDE</span><p>«${escapar(text)}»</p></div>`;
  const submitButton = (label: string) => `<button class="collections-primary" type="submit">${label}</button>`;
  function taskHtml(step: GuidedStepKey): string {
    switch (step) {
      case 'saldo': return `<dl class="collections-case-facts"><div><dt>Titular</dt><dd>Camila Rojas</dd></div><div><dt>Saldo inicial</dt><dd>$480.000</dd></div><div><dt>Vencimiento</dt><dd>10/11/2026</dd></div><div><dt>Contacto anterior</dt><dd>Reportó un abono de $80.000, pendiente de verificar.</dd></div></dl>
        <p>Verifica qué cambió antes de preparar el contacto.</p>
        <button type="button" class="collections-plan-source" data-case-source aria-expanded="${state.sourceOpen}" aria-controls="case-source">${state.sourceOpen ? '✓ Actualización consultada' : 'Consultar fuente del ejercicio →'}</button>
        <div id="case-source"${state.sourceOpen ? '' : ' hidden'} class="collections-plan-ledger"><span>FUENTE AUTORIZADA SOLO PARA ESTE CASO FICTICIO</span><dl><div><dt>Actualización</dt><dd>12/11/2026</dd></div><div><dt>Saldo anterior</dt><dd>$480.000</dd></div><div><dt>Abono confirmado y aplicado</dt><dd>− $80.000</dd></div><div><dt>Saldo vigente</dt><dd>$400.000</dd></div></dl></div>
        ${input('balance', '¿Qué saldo vas a informar?', 'Escribe el saldo vigente', 'inputmode="numeric" autocomplete="off"')}${submitButton('Verificar saldo →')}`;
      case 'saludo': return `<p>La ficha corresponde a <strong>Camila Rojas</strong>. Saluda y pregunta por ella.</p>
        <label class="collections-plan-field" for="case-greeting">Saludo<select id="case-greeting" data-case-field="greeting"><option${state.greeting === 'Buenos días' ? ' selected' : ''}>Buenos días</option><option${state.greeting === 'Buenas tardes' ? ' selected' : ''}>Buenas tardes</option></select></label>
        ${input('holder', '¿Por quién preguntas?', 'Nombre de la titular', 'autocomplete="off"')}${script(caseGreeting(state), true)}${submitButton('Saludar →')}`;
      case 'presentacion': return `${reply('Sí, habla Camila. ¿Con quién hablo?')}<p>Representas a <strong>${AGENCY}</strong> para <strong>${PORTFOLIO}</strong>.</p>
        ${input('advisor', 'Tu nombre como asesor', 'Ejemplo: Patricia Jaramillo', 'autocomplete="given-name"')}${input('portfolio', 'Cartera que representas', 'Nombre de la cartera asignada', 'autocomplete="off"')}
        ${script(casePresentation(state), true)}<p class="collections-plan-hint">La respuesta al saludo aún no verifica la identidad. Sigue el protocolo interno antes de compartir información de la deuda.</p>${submitButton('Presentarme →')}`;
      case 'calidad': return `<p class="collections-quality-scenario">Simulación · Grabación y monitoreo activos</p>
        <div class="collections-quality-message"><span aria-hidden="true">${icon('<rect x="23" y="8" width="18" height="30" rx="9"/><path d="M15 29v3a17 17 0 0 0 34 0v-3M32 49v9M23 58h18"/>')}</span><div><h6>Esto es lo que debes informar</h6><p>La llamada está siendo <strong>grabada y monitoreada</strong> por efectos de <strong>calidad</strong>.</p></div></div>
        ${reply('¿Para qué graban y monitorean esta llamada?')}${select('qualityAnswer', '¿Qué le respondes?', QUALITY_ANSWERS)}${submitButton('Responder y continuar →')}`;
      case 'escucha': return `<p class="collections-plan-identity">✓ En esta simulación ya se verificó que Camila es la titular, según el protocolo interno.</p><p>Informa el saldo y termina con una pregunta para comprender su situación.</p>
        ${textarea('question', '¿Qué le preguntarías?', 'Ejemplo: ¿Cómo está su situación para revisar las opciones autorizadas?')}${script(caseInformation(state), true)}
        <p class="collections-plan-hint">El caso no confirma demandas, embargos ni procesos jurídicos. Usa únicamente información con soporte.</p>${submitButton('Informar y escuchar a Camila →')}`;
      case 'posibilidad': return `${reply()}<p>Primero comprende lo que Camila puede asumir. No le impongas una cifra ni una fecha.</p>
        ${textarea('possibilityQuestion', 'Escribe una pregunta para explorar su posibilidad', 'Ejemplo: ¿Qué monto y fecha considera posibles después de revisar sus ingresos?')}
        ${script(`Entiendo que necesita revisar sus ingresos. ${state.possibilityQuestion.trim() || '[tu pregunta sobre su posibilidad de pago]'}`, true)}${submitButton('Explorar su posibilidad →')}`;
      case 'opciones': return `${reply('Aún no puedo confirmar un monto ni una fecha. Quisiera saber si pueden hacerme un descuento.')}<p>Comprueba qué puedes ofrecer antes de responder.</p>
        <button type="button" class="collections-plan-source" data-case-options aria-expanded="${state.optionsOpen}" aria-controls="case-options">${state.optionsOpen ? '✓ Ficha de opciones consultada' : 'Consultar opciones del ejercicio →'}</button>
        <div id="case-options"${state.optionsOpen ? '' : ' hidden'} class="collections-plan-ledger"><span>FICHA FICTICIA DE OPCIONES</span><dl><div><dt>Descuento aprobado</dt><dd>Ninguno confirmado</dd></div><div><dt>Alternativa de pago autorizada</dt><dd>Pendiente de validación interna</dd></div><div><dt>Posibilidad de Camila</dt><dd>Sin monto ni fecha confirmados</dd></div></dl></div>
        ${select('alternativeAction', '¿Cómo atiendes su solicitud?', ALTERNATIVE_ANSWERS)}${submitButton('Responder sin prometer condiciones →')}`;
      case 'cierre': return `<p>Camila necesita revisar sus ingresos. Su solicitud de descuento se consultará; todavía no hay aprobación ni un nuevo pago.</p>
        ${script('Señora Camila, revisamos un saldo pendiente de $400.000. No quedó un monto ni una fecha de pago confirmados. Consultaré su solicitud de descuento, que aún no está aprobada. ¿Es correcto?')}
        ${reply('Sí, quedo pendiente de la consulta.')}${select('summaryAnswer', '¿Qué quedó al cerrar esta conversación?', CLOSURE_ANSWERS)}${submitButton('Confirmar el cierre →')}`;
      case 'registro': return `<p class="collections-plan-success">✓ Contacto con titular. Sin compromiso de pago. Solicitud de descuento pendiente de consulta.</p>
        ${select('outcome', 'Tipificación del ejercicio', OUTCOMES)}${textarea('nextAction', 'Pendiente / próxima acción', 'Ejemplo: consultar la solicitud con el coordinador y registrar su respuesta.')}
        <p class="collections-plan-hint">Son etiquetas descriptivas para practicar. En una gestión real utiliza las tipificaciones y el seguimiento aprobados internamente.</p>${submitButton('Guardar nota del ejercicio →')}`;
    }
  }
  function completionHtml(): string {
    let summary = '';
    if (options.block === 'preparacion') summary = '<p class="collections-plan-success">Saldo verificado: $400.000 · Abono anterior aplicado: $80.000.</p>';
    if (options.block === 'contacto') summary = `${reply()}<details class="collections-more"><summary>Ver el guion que practicaste</summary><div class="collections-call-summary"><h5>Saludo</h5><p>${escapar(caseGreeting(state))}</p><h5>Presentación</h5><p>${escapar(casePresentation(state))}</p><h5>Calidad</h5><p>${QUALITY_NOTICE}</p><p class="collections-plan-identity">Identidad verificada dentro del escenario antes de hablar de la deuda.</p><h5>Información y escucha</h5><p>${escapar(caseInformation(state))}</p></div></details>`;
    if (options.block === 'alternativas') summary = `${script(CONSULTATION_SCRIPT)}<p class="collections-plan-hint">La siguiente etapa será cerrar y registrar esta consulta pendiente.</p>`;
    if (options.block === 'seguimiento') summary = `<h5>Tu nota de gestión</h5>${script(caseNote(state))}<p class="collections-plan-hint">Nota local de práctica. No se envió una comunicación ni se guardó una gestión real de cliente.</p>`;
    return `<div class="collections-dossier-complete"><p class="collections-kicker">${guide.steps.length} DE ${guide.steps.length} PASOS COMPLETADOS</p><h4 id="guided-detail-title" tabindex="-1">${guide.doneTitle}</h4><p>${guide.doneText}</p>${summary}<button type="button" data-case-continue class="collections-primary"${options.saving ? ' disabled' : ''}>${options.saving ? 'Guardando…' : guide.nextLabel}</button></div>`;
  }
  function render(): void {
    const current = guide.steps[progress.index];
    root.innerHTML = `<section class="collections-dossier" aria-labelledby="guided-case-title" aria-busy="${options.saving}">
      <header class="collections-dossier-head"><div><p>CASO FICTICIO F-204 · CONTINÚA LA MISMA GESTIÓN</p><h3 id="guided-case-title">El caso de Camila Rojas</h3><span>${AGENCY} para ${PORTFOLIO} · Vencimiento: 10/11/2026</span></div><span class="collections-dossier-badge">Paso a paso</span></header>
      <div class="collections-dossier-progress"><div><strong>${progress.index} de ${guide.steps.length} pasos completados en este bloque</strong><span>${progress.finished ? 'Listo para continuar' : 'Completa el paso actual'}</span></div><progress max="${guide.steps.length}" value="${progress.index}" aria-label="Avance de la práctica del bloque">${progress.index} de ${guide.steps.length}</progress></div>
      <div class="collections-plan-workspace"><aside class="collections-plan-actions" aria-label="Pasos de este bloque"><h4>Tu paso a paso</h4><p>Al completar un paso, se abre el siguiente.</p><ol class="collections-plan-slots">${guide.steps.map((step, index) => `<li class="${index < progress.index ? 'is-done' : index === progress.index ? 'is-active' : ''}"${index === progress.index ? ' aria-current="step"' : ''}><span class="collections-plan-number" aria-hidden="true">${index + 1}</span><strong>${step.title}</strong><small>${index < progress.index ? '✓ Completado' : index === progress.index ? 'Estás aquí · ' + step.short : 'Después del paso ' + index}</small></li>`).join('')}</ol></aside>
      <section class="collections-dossier-detail" aria-labelledby="guided-detail-title">${progress.finished ? completionHtml() : `<p class="collections-kicker">PASO ${progress.index + 1} DE ${guide.steps.length}</p><h4 id="guided-detail-title" tabindex="-1">${progress.index + 1}. ${current.title}</h4>${progress.index ? `<p class="collections-case-confirmation" role="status">✓ Paso ${progress.index} completado. Sigue con ${current.title.toLocaleLowerCase('es')}.</p>` : ''}<form data-case-form>${taskHtml(current.key)}</form>`}
      ${feedback ? `<p class="collections-dossier-feedback is-wrong" id="guided-feedback" role="alert" tabindex="-1">${escapar(feedback)} Puedes volver a intentarlo.</p>` : ''}
      ${options.error ? `<p id="collections-error" class="collections-submit-error" role="alert" tabindex="-1">${escapar(options.error)}</p>` : ''}</section></div>
      <p class="collections-dossier-note">Caso y datos de cliente ficticios · Nombres de entidades tomados del guion de referencia · Grabación, monitoreo e identidad verificada son supuestos del escenario · Guion y condiciones reales pendientes de validación interna.</p>
    </section>`;
    root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-case-field]').forEach((field) => field.addEventListener('input', () => {
      state[field.dataset.caseField as DraftField] = field.value;
      const preview = root.querySelector('[data-case-preview]');
      if (preview) preview.textContent = current.key === 'saludo' ? caseGreeting(state) : current.key === 'presentacion' ? casePresentation(state) : current.key === 'posibilidad' ? `Entiendo que necesita revisar sus ingresos. ${state.possibilityQuestion.trim() || '[tu pregunta sobre su posibilidad de pago]'}` : caseInformation(state);
    }));
    root.querySelector('[data-case-source]')?.addEventListener('click', () => { state.sourceOpen = true; render(); focus('[data-case-source]'); });
    root.querySelector('[data-case-options]')?.addEventListener('click', () => { state.optionsOpen = true; render(); focus('[data-case-options]'); });
    root.querySelector('[data-case-form]')?.addEventListener('submit', (event) => {
      event.preventDefault();
      if (options.saving || progress.finished) return;
      feedback = advanceGuidedCase(state, options.block);
      render(); focus(feedback ? '#guided-feedback' : '#guided-detail-title');
    });
    root.querySelector('[data-case-continue]')?.addEventListener('click', () => { if (progress.finished && !options.saving) options.onContinue(); });
  }
  render();
}
