export const PORTFOLIO = 'MARKETING PERSONAL';
export const AGENCY = 'CONSULTORIAS JURIDICAS';
export const QUALITY_NOTICE = 'Antes de continuar, le informo que esta llamada está siendo grabada y monitoreada por efectos de calidad.';
export const CLIENT_REPLY = 'Hoy no puedo confirmar una fecha ni un monto de pago. Necesito revisar mis ingresos. ¿Pueden bajar el saldo?';
export const CONSULTATION_SCRIPT = 'Voy a consultar su solicitud con el coordinador. Por ahora no hay un descuento aprobado ni un compromiso de pago. La consulta no garantiza una aprobación.';

export const GUIDED_BLOCKS = {
  preparacion: {
    intro: 'Revisa la ficha y verifica el saldo antes de contactar.',
    steps: [
      { key: 'saldo', title: 'Verificar el saldo', short: 'Revisa la ficha y su actualización.' },
    ],
    doneTitle: '¡Saldo verificado!', doneText: 'Revisaste la actualización del caso. Continúa con el contacto y la escucha.', nextLabel: 'Continuar al bloque 03 · Contacto y escucha →',
  },
  contacto: {
    intro: 'Saluda, preséntate, informa el protocolo de calidad y escucha a la titular.',
    steps: [
      { key: 'saludo', title: 'Saludar a la titular', short: 'Pregunta por la persona correcta.' },
      { key: 'presentacion', title: 'Presentarte por la cartera', short: 'Di tu nombre y a quién representas.' },
      { key: 'calidad', title: 'Informar el protocolo de calidad', short: 'Grabación y monitoreo por calidad.' },
      { key: 'escucha', title: 'Informar y escuchar', short: 'Comparte el saldo con la titular verificada.' },
    ],
    doneTitle: '¡Contacto realizado!', doneText: 'Informaste a la titular y dejaste una pregunta para comprender su situación.', nextLabel: 'Continuar al bloque 04 · Alternativas →',
  },
  alternativas: {
    intro: 'Comprende la posibilidad de Camila y consulta opciones sin prometer condiciones no aprobadas.',
    steps: [
      { key: 'posibilidad', title: 'Explorar su posibilidad', short: 'Comprende antes de proponer.' },
      { key: 'opciones', title: 'Revisar lo autorizado', short: 'Consulta la solicitud sin prometer.' },
    ],
    doneTitle: '¡Solicitud encaminada!', doneText: 'Exploraste la situación y comunicaste una consulta, sin aprobar descuentos ni inventar un compromiso.', nextLabel: 'Continuar al bloque 05 · Cierre y seguimiento →',
  },
  seguimiento: {
    intro: 'Resume lo conversado, confirma qué quedó pendiente y tipifica la gestión.',
    steps: [
      { key: 'cierre', title: 'Resumir y confirmar', short: 'Separa la consulta de un acuerdo.' },
      { key: 'registro', title: 'Tipificar y registrar', short: 'Deja el resultado y la próxima acción.' },
    ],
    doneTitle: '¡Gestión registrada!', doneText: 'Dejaste una nota con el resultado, el pendiente y la próxima acción.', nextLabel: 'Continuar al examen final →',
  },
} as const;
export type GuidedBlockKey = keyof typeof GUIDED_BLOCKS;
export type GuidedStepKey = typeof GUIDED_BLOCKS[GuidedBlockKey]['steps'][number]['key'];
type Choice = { value: string; text: string; feedback: string };
export const QUALITY_ANSWERS: Choice[] = [
  { value: 'pago', text: 'Para confirmar que ya hizo un pago.', feedback: 'La grabación y el monitoreo no confirman un pago. El aviso explica que se realizan por efectos de calidad.' },
  { value: 'calidad', text: 'Por efectos de calidad en la atención.', feedback: '' },
  { value: 'descuento', text: 'Para aprobarle un descuento.', feedback: 'La grabación y el monitoreo no aprueban descuentos. Su finalidad en el aviso es la calidad.' },
];
export const ALTERNATIVE_ANSWERS: Choice[] = [
  { value: 'aprobar', text: 'Confirmar el descuento que solicita.', feedback: 'La ficha no confirma un descuento. Consulta antes de ofrecerlo.' },
  { value: 'recargo', text: 'Añadir un recargo para negociar después.', feedback: 'No puedes añadir cargos sin soporte. Trabaja con el saldo verificado.' },
  { value: 'consultar', text: 'Consultar al coordinador sin garantizar aprobación.', feedback: '' },
];
export const CLOSURE_ANSWERS: Choice[] = [
  { value: 'compromiso', text: 'Un compromiso con monto y fecha.', feedback: 'Camila no confirmó monto ni fecha. No registres un compromiso que no existe.' },
  { value: 'consulta', text: 'Una solicitud por consultar, sin compromiso de pago.', feedback: '' },
  { value: 'pago', text: 'Un pago confirmado.', feedback: 'Durante esta conversación no se verificó un nuevo pago.' },
];
export const OUTCOMES: Choice[] = [
  { value: 'sin-compromiso', text: 'Contacto con titular · Sin compromiso de pago', feedback: '' },
  { value: 'compromiso', text: 'Compromiso de pago', feedback: 'Camila no confirmó monto ni fecha. No hay un compromiso de pago que registrar.' },
  { value: 'reportado', text: 'Pago reportado · Pendiente de verificar', feedback: 'Camila no reportó un nuevo pago en esta llamada. El abono anterior ya está aplicado.' },
  { value: 'confirmado', text: 'Pago confirmado en esta gestión', feedback: 'Informar el saldo no confirma un nuevo pago. En esta gestión no hubo un pago verificado.' },
];

export type GuidedCaseState = {
  progress: Record<GuidedBlockKey, { index: number; finished: boolean }>;
  sourceOpen: boolean; optionsOpen: boolean;
  balance: string; greeting: string; holder: string; advisor: string; portfolio: string;
  qualityAnswer: string; question: string; possibilityQuestion: string; alternativeAction: string;
  summaryAnswer: string; outcome: string; nextAction: string;
};
export type DraftField = Exclude<keyof GuidedCaseState, 'progress' | 'sourceOpen' | 'optionsOpen'>;
export function isGuidedBlock(key: string): key is GuidedBlockKey { return Object.hasOwn(GUIDED_BLOCKS, key); }
export function createGuidedCaseState(): GuidedCaseState {
  return {
    progress: { preparacion: { index: 0, finished: false }, contacto: { index: 0, finished: false }, alternativas: { index: 0, finished: false }, seguimiento: { index: 0, finished: false } },
    sourceOpen: false, optionsOpen: false, balance: '', greeting: 'Buenos días', holder: '', advisor: '', portfolio: '',
    qualityAnswer: '', question: '', possibilityQuestion: '', alternativeAction: '', summaryAnswer: '', outcome: '', nextAction: '',
  };
}
const normalized = (text: string) => text.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
function choiceError(choices: Choice[], value: string): string {
  const choice = choices.find((item) => item.value === value);
  return choice ? choice.feedback : 'Elige una respuesta para continuar.';
}
// Avanza solo la práctica de este bloque. El servidor conserva el desbloqueo entre bloques.
export function advanceGuidedCase(state: GuidedCaseState, block: GuidedBlockKey): string {
  const progress = state.progress[block];
  if (progress.finished) return '';
  const step = GUIDED_BLOCKS[block].steps[progress.index];
  let error = '';
  switch (step.key) {
    case 'saldo':
      if (!state.sourceOpen) error = 'Consulta primero la fuente del ejercicio. El saldo inicial puede estar desactualizado.';
      else if (state.balance.trim().replace(/[$\s.]/g, '').replace(/,00$/, '') !== '400000') error = 'La fuente confirma y aplica el abono de $80.000. El saldo vigente es $400.000. Revisa el valor e inténtalo de nuevo.';
      break;
    case 'saludo': if (normalized(state.holder) !== 'camila rojas') error = 'La ficha corresponde a Camila Rojas. Pregunta por la persona correcta.'; break;
    case 'presentacion':
      if (!state.advisor.trim()) error = 'Escribe tu nombre para que la titular sepa quién le habla.';
      else if (normalized(state.portfolio) !== normalized(PORTFOLIO)) error = `La cartera asignada es ${PORTFOLIO}. Revisa a quién representas.`;
      break;
    case 'calidad': error = choiceError(QUALITY_ANSWERS, state.qualityAnswer); break;
    case 'escucha': if (state.question.trim().length < 8) error = 'Escribe una pregunta breve para comprender la situación de la titular.'; break;
    case 'posibilidad': if (state.possibilityQuestion.trim().length < 8) error = 'Añade una pregunta para explorar qué monto y fecha considera posibles, sin imponerlos.'; break;
    case 'opciones':
      error = state.optionsOpen ? choiceError(ALTERNATIVE_ANSWERS, state.alternativeAction) : 'Consulta primero la ficha de opciones del ejercicio.';
      break;
    case 'cierre': error = choiceError(CLOSURE_ANSWERS, state.summaryAnswer); break;
    case 'registro':
      error = choiceError(OUTCOMES, state.outcome);
      if (!error && state.nextAction.trim().length < 8) error = 'Añade una próxima acción concreta para dejar claro qué queda pendiente.';
      break;
  }
  if (!error) {
    progress.index += 1;
    progress.finished = progress.index === GUIDED_BLOCKS[block].steps.length;
  }
  return error;
}
export function caseGreeting(state: GuidedCaseState): string {
  return `${state.greeting}. ¿Me comunico con la señora ${state.holder.trim() || 'Camila Rojas'}?`;
}
export function casePresentation(state: GuidedCaseState): string {
  return `Mi nombre es ${state.advisor.trim() || '[tu nombre]'}, me comunico de ${AGENCY} para ${state.portfolio.trim() || '[nombre de la cartera]'}. ¡Espero se encuentre muy bien!`;
}
export function caseInformation(state: GuidedCaseState): string {
  return `Señora Camila, le voy a poner en contexto y al finalizar con gusto revisamos sus dudas. Me comunico por la obligación registrada con ${PORTFOLIO}. Según la fuente actualizada del ejercicio, su saldo pendiente es de $400.000, con vencimiento el 10 de noviembre de 2026. El abono anterior de $80.000 ya está aplicado. ${state.question.trim() || '[tu pregunta para comprender la situación]'}`;
}
export function caseNote(state: GuidedCaseState): string {
  return `Cartera ${PORTFOLIO}. Contacto con Camila Rojas, titular verificada en el escenario. Se informa saldo verificado de $400.000 y abono anterior de $80.000 aplicado. La titular necesita revisar sus ingresos y solicita un descuento, sin confirmar monto ni fecha de pago. Se comunica que la solicitud se consultará con el coordinador y que no hay descuento aprobado. Resultado: contacto con titular, sin compromiso de pago. Pendiente / próxima acción: ${state.nextAction.trim()}`;
}
