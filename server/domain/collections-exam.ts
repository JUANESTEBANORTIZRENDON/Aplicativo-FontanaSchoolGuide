// Evaluación formativa. Puntajes y fallos críticos requieren validación interna.
export const EXAM_KEY = 'examen';
export const EXAM_DRAFT_KEY = 'examen-borrador';
export const EXAM_HISTORY_PREFIX = 'examen-intento-';
export const EXAM_CONTENT_VERSION = 2;
export const EXAM_MIN_SCORE = 80;
export const EXAM_MAX_TEXT = 1000;

type ExamOption = { id: string; text: string; correct: boolean; feedback: string; critical?: string };
type Criterion = { label: string; points: number; matches: (text: string) => boolean };
type BaseQuestion = { key: string; prompt: string; points: number };
type ChoiceQuestion = BaseQuestion & { kind: 'choice' | 'select'; options: ExamOption[] };
type WrittenQuestion = BaseQuestion & { kind: 'text'; criteria: Criterion[]; example: string };
type ExamQuestion = ChoiceQuestion | WrittenQuestion;
type PublicExamQuestion = BaseQuestion & ({ kind: 'text'; maxLength: number } | { kind: 'choice' | 'select'; options: { id: string; text: string }[] });
type ExamSection = { key: string; title: string; points: number; situation: string; strength: string; improvement: string; questions: ExamQuestion[] };
const option = (id: string, text: string, correct: boolean, feedback: string, critical?: string): ExamOption => ({ id, text, correct, feedback, ...(critical ? { critical } : {}) });
const criterion = (label: string, points: number, pattern: RegExp): Criterion => ({ label, points, matches: (text) => pattern.test(text) });
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[$.]/g, '').replace(/\s+/g, ' ').trim();
function amountDate(text: string, amount: '100000' | '300000', day: '20' | '30'): boolean {
  const amounts = [...text.matchAll(/100000|300000|cien mil|trescientos mil/g)];
  const dates = [...text.matchAll(/\b(20|30)\s*(?:[/-]\s*11|(?:de )?noviembre)|\b(veinte|treinta) de noviembre/g)];
  const distance = (a: RegExpMatchArray, b: RegExpMatchArray) => Math.max(0, a.index! - (b.index! + b[0].length), b.index! - (a.index! + a[0].length));
  return dates.some((date) => {
    const parsedDay = date[1] ?? (date[2] === 'veinte' ? '20' : '30');
    if (parsedDay !== day || !amounts.length) return false;
    const closest = amounts.reduce((best, current) => distance(current, date) < distance(best, date) ? current : best);
    const parsedAmount = closest[0] === 'cien mil' ? '100000' : closest[0] === 'trescientos mil' ? '300000' : closest[0];
    return parsedAmount === amount && distance(closest, date) < 70;
  });
}

export const EXAM_CRITICAL_RULES = [
  'Compartir información de la deuda con un tercero o antes de verificar la identidad.',
  'Aprobar descuentos, plazos o recargos sin autorización.',
  'Afirmar amenazas o procesos jurídicos que el caso no respalda, o presionar al cliente.',
  'Registrar un compromiso o un reporte como pago confirmado sin verificarlo.',
  'Inventar frecuencias o canales de contacto en lugar de seguir el protocolo interno.',
];

export const EXAM_SECTIONS: ExamSection[] = [
  {
    key: 'inicio', title: 'Inicio de la gestión', points: 15,
    situation: 'Eres asesor de CONSULTORIAS JURIDICAS para MARKETING PERSONAL. Llamas a Camila Rojas. En la simulación, la grabación y el monitoreo por calidad están activos.',
    strength: 'Inicias con una presentación clara y cuidas la identidad de la titular.', improvement: 'Repasa saludo, presentación, aviso de calidad y verificación de identidad antes de informar la deuda.',
    questions: [
      { key: 'inicio-accion', kind: 'choice', points: 5, prompt: 'Contesta una persona. ¿Cómo abres la conversación?', options: [
        option('identificar', 'Saludo, pregunto por Camila, me presento y sigo el protocolo de identidad antes de hablar de la deuda.', true, 'La información de la obligación se comparte después de verificar la identidad según el protocolo interno.'),
        option('saldo', 'Digo de inmediato que Camila debe $400.000, aunque no sepa quién contestó.', false, 'Primero debes verificar la identidad.', EXAM_CRITICAL_RULES[0]),
        option('ordenar', 'Pido que me pasen a Camila sin saludar ni presentarme.', false, 'Una apertura respetuosa permite explicar quién llama y por qué se solicita hablar con la titular.'),
      ] },
      { key: 'inicio-guion', kind: 'text', points: 10, prompt: 'Redacta tu saludo, presentación y aviso de calidad en 2 o 3 frases. Usa tu nombre y las entidades de la ficha; todavía no informes la deuda.', criteria: [
        criterion('Saludo respetuoso', 2, /buenos dias|buenas tardes|buenas noches|hola|cordial saludo/),
        criterion('Presentación con nombre', 2, /(?:mi nombre es|soy|le habla)\s+[a-z]{2,}/),
        criterion('Entidad que representa', 2, /consultorias juridicas/),
        criterion('Cartera asignada', 2, /marketing personal/),
        { label: 'Aviso de grabación y monitoreo por calidad', points: 2, matches: (text) => /grabad|grabacion/.test(text) && /monitore/.test(text) && /calidad/.test(text) && !/no (?:esta|sera|se) (?:siendo )?(?:grabad|monitore)/.test(text) },
      ], example: 'Buenos días, ¿hablo con Camila Rojas? Mi nombre es Patricia, de CONSULTORIAS JURIDICAS para MARKETING PERSONAL. Le informo que esta llamada está siendo grabada y monitoreada por efectos de calidad.' },
    ],
  },
  {
    key: 'escenario', title: 'Identificación del escenario', points: 10,
    situation: 'La fuente actualizada muestra saldo anterior de $480.000 y un abono de $80.000 confirmado y aplicado. Ya se verificó la identidad de Camila. Ella dice: «Quiero pagar, pero debo revisar mis ingresos para saber cuánto y cuándo».',
    strength: 'Interpretas la ficha y distingues intención de pago de un acuerdo concreto.', improvement: 'Revisa el saldo actualizado y diferencia voluntad de pago, compromiso y pago confirmado.',
    questions: [
      { key: 'escenario-saldo', kind: 'select', points: 5, prompt: '¿Qué saldo informas?', options: [
        option('480', '$480.000.', false, 'El abono ya está aplicado: el saldo vigente es $400.000.'),
        option('400', '$400.000.', true, 'Usas la información actualizada y el abono verificado.'),
        option('800', '$80.000.', false, 'Ese es el abono anterior, no el saldo pendiente.'),
      ] },
      { key: 'escenario-accion', kind: 'choice', points: 5, prompt: '¿Cómo continúas con lo que dijo Camila?', options: [
        option('compromiso', 'Registro un compromiso por $400.000 para mañana.', false, 'No puedes completar por ella un monto o una fecha que no confirmó.'),
        option('confirmado', 'Marco la deuda como pagada porque quiere pagar.', false, 'La intención de pagar no confirma un pago.', EXAM_CRITICAL_RULES[3]),
        option('explorar', 'Reconozco su voluntad de pago y pregunto qué monto y fecha puede asumir.', true, 'Escuchas y exploras una posibilidad sin inventar un acuerdo.'),
      ] },
    ],
  },
  {
    key: 'negociacion', title: 'Negociación', points: 20,
    situation: 'Cada situación es un final distinto de la conversación con Camila. El saldo es $400.000. Identifica la alternativa y consulta las condiciones autorizadas para esta cuenta; no hay un descuento aprobado.',
    strength: 'Distingues las alternativas y respetas los límites de autorización.', improvement: 'Refuerza pago total, abono con fechas, acuerdo de pago total y consulta de descuentos antes de ofrecerlos.',
    questions: [
      { key: 'negociacion-total', kind: 'select', points: 4, prompt: '«Puedo cancelar los $400.000 completos hoy». ¿Qué alternativa encaja?', options: [
        option('abono', 'Abono + fechas.', false, 'Puede cancelar el saldo completo hoy.'),
        option('total', 'Pago total.', true, 'Identificas pago total; se confirma únicamente tras verificarlo.'),
        option('fecha', 'Fecha Acuerdo Pago total para una fecha futura.', false, 'No está proponiendo una fecha futura.'),
      ] },
      { key: 'negociacion-abono', kind: 'select', points: 4, prompt: '«Puedo abonar $100.000 y acordar fechas para los $300.000 restantes». ¿Qué alternativa encaja?', options: [
        option('abono', 'Abono + fechas, según las condiciones autorizadas.', true, 'Debes concretar el abono y las fechas del saldo restante.'),
        option('total', 'Pago total inmediato.', false, 'Solo ofrece una parte del saldo ahora.'),
        option('descuento', 'Descuento ya aprobado.', false, 'No se ha aprobado un descuento.'),
      ] },
      { key: 'negociacion-fecha', kind: 'select', points: 4, prompt: '«Pagaré los $400.000 el 20 de noviembre de 2026». ¿Qué alternativa encaja?', options: [
        option('confirmado', 'Pago confirmado.', false, 'Es un acuerdo futuro, no un pago confirmado.', EXAM_CRITICAL_RULES[3]),
        option('abono', 'Abono parcial.', false, 'Propone pagar el saldo completo.'),
        option('fecha', 'Fecha Acuerdo Pago total.', true, 'Registra el monto y la fecha del acuerdo y deja su seguimiento.'),
      ] },
      { key: 'negociacion-descuento', kind: 'choice', points: 8, prompt: 'Camila pide un descuento. ¿Qué le dices?', options: [
        option('aprobar', 'Le apruebo un 30 % de descuento para que pague hoy.', false, 'El caso no autoriza ese descuento.', EXAM_CRITICAL_RULES[1]),
        option('consultar', 'Voy a validar la solicitud con mi líder. Por ahora no hay un descuento aprobado.', true, 'Consultar no equivale a aprobar ni permite prometer el resultado.'),
        option('recargo', 'Le agrego $200.000 y luego los retiro como descuento.', false, 'El caso no autoriza recargos ni descuentos inventados.', EXAM_CRITICAL_RULES[1]),
      ] },
    ],
  },
  {
    key: 'objeciones', title: 'Manejo de objeciones', points: 15,
    situation: 'Camila dice: «Este mes tuve menos ingresos. No puedo pagar todo y me preocupa quedar mal».',
    strength: 'Escuchas la dificultad y buscas una salida sin presión ni promesas no aprobadas.', improvement: 'Reconoce la dificultad, pregunta por su capacidad y ofrece revisar solo alternativas autorizadas.',
    questions: [
      { key: 'objeciones-accion', kind: 'choice', points: 6, prompt: '¿Qué respuesta mantiene abierta la conversación?', options: [
        option('amenaza', 'Si no paga hoy, mañana le embargamos sus bienes.', false, 'La ficha no respalda una medida jurídica ni esa amenaza.', EXAM_CRITICAL_RULES[2]),
        option('escuchar', 'Entiendo su preocupación. Revisemos qué puede asumir y las alternativas autorizadas.', true, 'Escuchar permite explorar una posibilidad realista.'),
        option('terminar', 'Entonces no hay nada que hablar.', false, 'Terminar sin explorar su situación pierde la oportunidad de comprenderla.'),
      ] },
      { key: 'objeciones-respuesta', kind: 'text', points: 9, prompt: 'Escribe en 1 o 2 frases qué le responderías a Camila para comprender su posibilidad de pago y revisar una salida permitida.', criteria: [
        criterion('Reconoce la dificultad sin juzgar', 3, /entiendo|comprendo|lamento|gracias por (?:contar|explicar|comentar)|reconozco su/),
        { label: 'Pregunta por monto, fecha o posibilidad', points: 3, matches: (text) => /\?|(?:que|cual|cuanto|cuando|podria|puede)\b/.test(text) && /monto|fecha|posibilidad|cuanto|cuando|abonar|pagar/.test(text) },
        criterion('Revisa opciones autorizadas o consulta al líder', 3, /(?:opcion(?:es)?|alternativas?|condicion(?:es)?)\s+(?:de pago )?(?:autorizad|permitid)|(?:consult|valid|revis)[a-z]*.{0,45}(?:lider|coordinador|autorizacion)/),
      ], example: 'Entiendo su preocupación. ¿Qué monto y fecha podría asumir para que revisemos las alternativas autorizadas?' },
    ],
  },
  {
    key: 'cierre', title: 'Cierre', points: 15,
    situation: 'En este caso ficticio, la ficha de opciones autoriza el acuerdo que Camila acepta: abono de $100.000 el 20/11/2026 y pago de los $300.000 restantes el 30/11/2026. No ha realizado ningún nuevo pago.',
    strength: 'Resumes montos y fechas y dejas claro lo que sigue sin confundir acuerdo con pago.', improvement: 'Confirma con la titular los montos y las dos fechas y deja pendiente verificar los pagos.',
    questions: [
      { key: 'cierre-registro', kind: 'choice', points: 5, prompt: '¿Qué resultado corresponde?', options: [
        option('pago', 'Pago confirmado por $400.000.', false, 'Solo existe un acuerdo futuro.', EXAM_CRITICAL_RULES[3]),
        option('acuerdo', 'Acuerdo de abono y fechas; pagos pendientes de verificar.', true, 'El acuerdo todavía requiere cumplimiento y verificación.'),
        option('sin', 'No hubo acuerdo.', false, 'Camila sí aceptó montos y fechas concretos.'),
      ] },
      { key: 'cierre-guion', kind: 'text', points: 10, prompt: 'Redacta el cierre en 2 frases: resume los dos montos con sus fechas, pide confirmación y explica el seguimiento o la verificación pendiente.', criteria: [
        criterion('Abono de $100.000', 2, /100000|cien mil/),
        { label: 'Fecha del abono: 20 de noviembre', points: 2, matches: (text) => amountDate(text, '100000', '20') },
        criterion('Saldo restante de $300.000', 2, /300000|trescientos mil/),
        { label: 'Fecha del saldo: 30 de noviembre', points: 2, matches: (text) => amountDate(text, '300000', '30') },
        { label: 'Pide confirmación y explica el seguimiento', points: 2, matches: (text) => /confirma|correcto|de acuerdo/.test(text) && /verifica|seguimiento|pendiente de (?:confirmar|validar)/.test(text) },
      ], example: 'Confirmamos un abono de $100.000 el 20/11/2026 y los $300.000 restantes el 30/11/2026, ¿está de acuerdo? Daré seguimiento a las fechas y verificaré cada pago en la fuente autorizada.' },
    ],
  },
  {
    key: 'seguimiento', title: 'Seguimiento', points: 10,
    situation: 'Define el siguiente paso según el resultado, usando las fuentes y el protocolo internos, sin crear reglas de contacto.',
    strength: 'Dejas una acción concreta para verificar o dar continuidad a la gestión.', improvement: 'Diferencia un pago reportado de uno confirmado y aplica el protocolo de seguimiento.',
    questions: [
      { key: 'seguimiento-reporte', kind: 'choice', points: 5, prompt: 'Camila dice que ya pagó, pero aún no aparece en la fuente autorizada. ¿Qué haces?', options: [
        option('confirmar', 'Confirmo el pago porque ella lo dice.', false, 'Un reporte requiere verificación.', EXAM_CRITICAL_RULES[3]),
        option('omitir', 'Omito el reporte hasta que aparezca el pago.', false, 'Registra lo que informa y lo que falta por verificar.'),
        option('verificar', 'Registro pago reportado, pendiente de verificar en la fuente autorizada.', true, 'Conservas el reporte sin dar el pago por confirmado.'),
      ] },
      { key: 'seguimiento-sin-respuesta', kind: 'select', points: 5, prompt: 'No hubo respuesta al intento de contacto. ¿Cuál es el siguiente paso?', options: [
        option('insistir', 'Llamo cada diez minutos hasta que conteste.', false, 'No inventes reglas de frecuencia.', EXAM_CRITICAL_RULES[4]),
        option('interno', 'Registro el intento y defino el seguimiento por el canal y protocolo autorizados.', true, 'La frecuencia y los canales deben validarse internamente.'),
        option('pago', 'Cierro la deuda como pagada.', false, 'No hubo contacto ni evidencia de pago.', EXAM_CRITICAL_RULES[3]),
      ] },
    ],
  },
  {
    key: 'tipificacion', title: 'Tipificación', points: 15,
    situation: 'Son cuatro situaciones independientes de Camila. Clasifica lo que realmente ocurrió en cada una.',
    strength: 'Distingues no acuerdo, voluntad de pago, contacto con tercero y falta de respuesta.', improvement: 'Repasa las cuatro tipificaciones y registra solo lo ocurrido, sin suponer acuerdos ni contactos.',
    questions: [
      { key: 'tipificacion-no-acuerdo', kind: 'select', points: 4, prompt: 'Hablaste con Camila. No acepta ninguna alternativa ni manifiesta intención de pagar.', options: typificationOptions('sin-acuerdo') },
      { key: 'tipificacion-voluntad', kind: 'select', points: 4, prompt: 'Camila quiere pagar, pero aún no puede definir monto ni fecha.', options: typificationOptions('voluntad') },
      { key: 'tipificacion-tercero', kind: 'select', points: 4, prompt: 'Responde su familiar. Camila no está disponible y no compartes información de la deuda.', options: typificationOptions('tercero') },
      { key: 'tipificacion-no-contesta', kind: 'select', points: 3, prompt: 'Nadie responde al intento de contacto; no hubo conversación.', options: typificationOptions('no-contesta') },
    ],
  },
];

function typificationOptions(expected: string): ExamOption[] {
  return [['sin-acuerdo', 'No hubo acuerdo'], ['voluntad', 'Voluntad de pago'], ['tercero', 'Contacto con un tercero'], ['no-contesta', 'El cliente no contesta']].map(([id, text]) => option(id!, text!, id === expected, 'Clasifica el resultado observado: no acuerdo, intención de pago sin monto ni fecha, contacto con otra persona o falta de respuesta.'));
}
export const COLLECTIONS_EXAM = EXAM_SECTIONS.flatMap((section) => section.questions);
export function publicExam() {
  return {
    version: EXAM_CONTENT_VERSION, minScore: EXAM_MIN_SCORE, maxScore: 100, total: COLLECTIONS_EXAM.length,
    criticalRules: EXAM_CRITICAL_RULES,
    sections: EXAM_SECTIONS.map(({ key, title, points, situation, questions }) => ({ key, title, points, situation, questions: questions.map((q): PublicExamQuestion => q.kind === 'text' ? { key: q.key, prompt: q.prompt, points: q.points, kind: q.kind, maxLength: EXAM_MAX_TEXT } : { key: q.key, prompt: q.prompt, points: q.points, kind: q.kind, options: q.options.map(({ id, text }) => ({ id, text })) }) })),
  };
}

export function validateExamSection(sectionIndex: number, answers: Record<string, string>): void {
  const section = EXAM_SECTIONS[sectionIndex];
  if (!section || Object.keys(answers).length !== section.questions.length || section.questions.some((q) => {
    const answer = answers[q.key];
    return typeof answer !== 'string' || (q.kind === 'text' ? !answer.trim() || answer.length > EXAM_MAX_TEXT : !q.options.some((o) => o.id === answer));
  })) throw new Error('Completa las respuestas de esta sección. En los textos puedes escribir hasta 1000 caracteres.');
}

// Detecta afirmaciones explícitas de riesgo en los textos. No pretende reemplazar
// una revisión humana del lenguaje; se informa este alcance al asesor.
function writtenCriticalErrors(answer: string): string[] {
  const risks: [RegExp, string][] = [
    [/(?:apruebo|autorizo|garantizo|concedo|ofrezco|aplico)\s+(?:(?:un|el|una|la)\s+)?(?:\d+\s*%\s*(?:de\s+)?)?(?:descuento|condonacion|rebaja|plazo)/g, EXAM_CRITICAL_RULES[1]!],
    [/(?:le vamos a embargar|le embargamos|sera embargad|sera demandad|procederemos (?:al|con el) embargo|tiene que pagar hoy|debe pagar hoy sin falta)/g, EXAM_CRITICAL_RULES[2]!],
    [/(?:pago confirmado|ya (?:esta|queda) pagad|deuda (?:pagada|cancelada)|registr(?:o|are) (?:el )?pago como confirmado)/g, EXAM_CRITICAL_RULES[3]!],
    [/(?:inform(?:o|are)|compart(?:o|ire)|revel(?:o|are)) (?:el saldo|la deuda|la obligacion|informacion de la deuda).{0,35}(?:tercero|familiar|hermano)/g, EXAM_CRITICAL_RULES[0]!],
  ];
  const reasons = new Set<string>();
  for (const clause of answer.split(/[.!?;\n]/).map(normalize)) for (const [pattern, reason] of risks) {
    for (const match of clause.matchAll(pattern)) {
      const prefix = clause.slice(Math.max(0, match.index! - 55), match.index);
      // «No hay pago confirmado», «sin pago confirmado», «no puedo ofrecer…».
      if (!/\b(?:no(?:\s+(?:le|lo|la|hay|existe|puedo|podemos|debo|debemos|es|esta|queda|un|el|ningun|ninguna)){0,4}|sin(?:\s+un)?|nunca|jamas|evitar)\s*$/.test(prefix)) reasons.add(reason);
    }
  }
  return [...reasons];
}

export function gradeExam(answers: Record<string, string>) {
  if (Object.keys(answers).length !== COLLECTIONS_EXAM.length) throw new Error('Completa las siete secciones del examen.');
  for (const [index, section] of EXAM_SECTIONS.entries()) validateExamSection(index, Object.fromEntries(section.questions.map((q) => [q.key, answers[q.key]!])));
  const criticalErrors: { key: string; section: string; reason: string }[] = [];
  const sections = EXAM_SECTIONS.map((section) => {
    const results = section.questions.map((question) => {
      const answer = answers[question.key]!;
      if (question.kind !== 'text') {
        const selected = question.options.find((o) => o.id === answer)!;
        if (selected.critical) criticalErrors.push({ key: question.key, section: section.title, reason: selected.critical });
        return { key: question.key, prompt: question.prompt, kind: question.kind, selected: answer, selectedText: selected.text, points: selected.correct ? question.points : 0, maxPoints: question.points, correct: selected.correct, feedback: selected.feedback, expected: question.options.find((o) => o.correct)!.text, criteria: [] as { label: string; met: boolean }[] };
      }
      const text = normalize(answer);
      const risks = writtenCriticalErrors(answer);
      for (const reason of risks) criticalErrors.push({ key: question.key, section: section.title, reason });
      const criteria = question.criteria.map((c) => ({ label: c.label, met: c.matches(text), points: c.points }));
      const points = risks.length ? 0 : criteria.reduce((sum, c) => sum + (c.met ? c.points : 0), 0);
      return { key: question.key, prompt: question.prompt, kind: question.kind, selected: answer, selectedText: answer, points, maxPoints: question.points, correct: points === question.points, feedback: 'Revisión automática de elementos básicos del texto; el líder debe validar su calidad y aplicación real.', expected: question.example, criteria: criteria.map(({ label, met }) => ({ label, met })) };
    });
    const score = results.reduce((sum, r) => sum + r.points, 0);
    return { key: section.key, title: section.title, score, maxScore: section.points, strength: section.strength, improvement: section.improvement, results };
  });
  const score = sections.reduce((sum, section) => sum + section.score, 0);
  const passed = score >= EXAM_MIN_SCORE && !criticalErrors.length;
  return {
    version: EXAM_CONTENT_VERSION, passed, verdict: passed ? 'Apto' as const : 'Requiere refuerzo' as const, score, maxScore: 100, minScore: EXAM_MIN_SCORE,
    criticalErrors, sections,
    strengths: sections.filter((s) => s.score / s.maxScore >= .8).map((s) => s.strength),
    improvements: sections.filter((s) => s.score / s.maxScore < .8).map((s) => s.improvement),
  };
}
