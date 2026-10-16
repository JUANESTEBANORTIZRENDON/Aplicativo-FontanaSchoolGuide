export const COLLECTIONS_SLUG = 'induccion-cobranzas';
export const COLLECTIONS_VERSION = 1;
export const COLLECTIONS_KEYS = ['conceptos', 'preparacion', 'contacto', 'alternativas', 'seguimiento'] as const;
export type CollectionsKey = typeof COLLECTIONS_KEYS[number];
type Option = { id: string; text: string; correct: boolean; feedback: string };
type Question = { key: string; prompt: string; kind: 'select' | 'radio'; options: Option[] };
export type CollectionsBlock = {
  key: CollectionsKey; title: string; objective: string; explanation: string[];
  example: { title: string; paragraphs: string[] }; validation: string[];
  exercise: string; questions: Question[]; expected: string;
};
const option = (id: string, text: string, correct: boolean, feedback: string): Option => ({ id, text, correct, feedback });
const question = (key: string, prompt: string, options: Option[], kind: 'select' | 'radio' = 'radio'): Question => ({ key, prompt, options, kind });
const concepts = [
  ['cartera', 'Cartera', 'Conjunto de cuentas que se gestionan.'],
  ['saldo', 'Saldo', 'Dinero que sigue pendiente por pagar.'],
  ['vencimiento', 'Vencimiento', 'Fecha límite para realizar un pago.'],
  ['mora', 'Mora', 'Deuda pendiente después de la fecha de pago.'],
  ['abono', 'Abono', 'Pago de una parte de la deuda.'],
  ['compromiso', 'Compromiso', 'Promesa de pagar un monto en una fecha.'],
  ['pago', 'Pago confirmado', 'Pago recibido y verificado en la fuente autorizada.'],
] as const;

// Tres alternativas cortas por concepto; se conservan los IDs de las respuestas anteriores.
const conceptChoices: Record<typeof concepts[number][0], readonly string[]> = {
  cartera: ['saldo', 'cartera', 'vencimiento'],
  saldo: ['saldo', 'abono', 'mora'],
  vencimiento: ['pago', 'compromiso', 'vencimiento'],
  mora: ['mora', 'saldo', 'abono'],
  abono: ['compromiso', 'abono', 'pago'],
  compromiso: ['pago', 'vencimiento', 'compromiso'],
  pago: ['compromiso', 'pago', 'mora'],
};

export const COLLECTIONS_BLOCKS: CollectionsBlock[] = [
  {
    key: 'conceptos', title: 'Conceptos básicos',
    objective: 'Distinguir la información de una deuda y reconocer qué ocurrió y qué está pendiente.',
    explanation: [
      'La cartera es el conjunto de cuentas que se gestionan. Cada caso tiene un saldo y una fecha de vencimiento. Si la obligación continúa pendiente después de esa fecha, se encuentra en mora.',
      'Un abono es un pago parcial. Un compromiso expresa algo que la persona hará; todavía no demuestra que haya pagado. Un pago confirmado exige verificar la recepción y aplicación en la fuente autorizada.',
      'La frase «voy a pagar» es una promesa. La frase «ya pagué» es un reporte del cliente que también necesita verificación. Un comprobante puede ayudar a revisar, pero su existencia por sí sola no reemplaza la confirmación autorizada.',
    ],
    example: { title: 'Caso ficticio · Camila', paragraphs: [
      'La ficha de Camila muestra un saldo de $480.000 y un vencimiento del 10 de noviembre de 2026. En este ejercicio la fecha de gestión es el 12 de noviembre y el saldo sigue pendiente.',
      'Camila dice: «El 20 de noviembre abonaré $200.000». Se registra un compromiso de abono. No se resta ese valor del saldo ni se marca como pago confirmado.',
    ] },
    validation: ['Validación interna: fichas de producto, marca o entidad representada y funcionamiento de cada cartera.', 'Validación interna: guion de saludo, presentación, verificación de identidad y orientación para responder objeciones.', 'Validación interna: alternativas de negociación permitidas y alcance de la autorización del asesor.', 'Validación interna: fuente en la que se confirma un pago y quién puede confirmar su aplicación.', 'Validación interna: composición del saldo, conceptos cobrables y actualización de la información. No se calculan cargos en este ejercicio.'],
    exercise: 'Lee cada concepto y elige una de las tres definiciones. Después identifica si el caso es una promesa o un pago confirmado.',
    questions: [
      ...concepts.map(([key, title, definition]) => question(key, `¿Qué significa ${title.toLowerCase()}?`, conceptChoices[key].map((choice) => {
        const [id, name, text] = concepts.find(([id]) => id === choice)!;
        return option(id, text, id === key, id === key ? `Correcto. ${title}: ${definition}` : `Esta definición corresponde a ${name.toLowerCase()}. ${title}: ${definition}`);
      }))),
      question('promesa', 'Camila anuncia un abono para el 20 de noviembre. ¿Qué puedes registrar hoy?', [
        option('compromiso', 'Compromiso de abono pendiente de confirmar.', true, 'La intención de pagar se registra como compromiso. El pago todavía no ocurrió ni fue confirmado.'),
        option('confirmado', 'Pago confirmado y saldo reducido en $200.000.', false, 'La promesa no autoriza a confirmar un pago ni a reducir el saldo.'),
        option('comprobante', 'Pago confirmado si envía una imagen de un comprobante.', false, 'El soporte se revisa según el procedimiento interno; la confirmación depende de la fuente autorizada.'),
      ]),
    ],
    expected: 'Relacionar correctamente los siete conceptos y registrar el anuncio de Camila como compromiso de abono, sin presentarlo como pago confirmado.',
  },
  {
    key: 'preparacion', title: 'Preparación de la gestión',
    objective: 'Revisar lo que sabes del caso y reconocer lo que debes aclarar antes de contactar.',
    explanation: [
      'Antes del contacto, revisa la identificación del caso, el saldo disponible, el vencimiento, el historial de contactos y los compromisos anteriores. Comprueba la fecha de actualización de la información.',
      'Separa los hechos confirmados, lo reportado por el cliente y los pendientes. Revisa las alternativas que realmente están autorizadas para ese caso. Una condición mencionada en otra cuenta no se traslada automáticamente a esta.',
      'Si falta información necesaria para una gestión segura, aclárala por la vía interna correspondiente. No completes los vacíos con suposiciones.',
    ],
    example: { title: 'Ficha ficticia · Caso F-204', paragraphs: [
      'Titular: Camila Rojas. Saldo en ficha: $480.000. Vencimiento: 10 de noviembre de 2026. Fecha de actualización del saldo: sin dato.',
      'Contacto anterior: la cliente informó un abono de $80.000. Pendiente: verificar su aplicación. El número de contacto está registrado, pero falta revisar si el canal está autorizado. La ficha de opciones no tiene aprobación visible.',
    ] },
    validation: ['Validación interna: origen y vigencia del saldo, datos que se deben revisar y ruta para resolver inconsistencias.', 'Validación interna: canales, horarios, frecuencia, autorizaciones de contacto y catálogo vigente de alternativas. Aquí no se establecen esas reglas.'],
    exercise: 'Analiza la ficha F-204 y selecciona la revisión o aclaración necesaria en cada situación.',
    questions: [
      question('saldo', 'El saldo no tiene fecha de actualización. ¿Qué haces?', [
        option('verificar', 'Verificar su vigencia en la fuente autorizada antes de usarlo.', true, 'Debes trabajar con información vigente, no asumir que el saldo sigue igual.'),
        option('asumir', 'Asumir que está actualizado porque aparece en pantalla.', false, 'Ver un dato no demuestra cuándo se actualizó.'),
        option('restar', 'Restar los $80.000 reportados y usar el resultado.', false, 'Un reporte sin confirmar no permite modificar el saldo.'),
      ]),
      question('historial', '¿Qué revisas del contacto anterior?', [
        option('pendiente', 'Lo conversado, el abono reportado y la verificación pendiente.', true, 'El historial permite continuar la gestión sin perder hechos ni pendientes.'),
        option('ignorar', 'Nada; comenzar de nuevo evita revisar el historial.', false, 'Ignorar el historial puede generar información contradictoria.'),
        option('confirmar', 'Marcar el abono como confirmado porque ya lo mencionaron.', false, 'Que alguien lo haya mencionado no confirma su aplicación.'),
      ]),
      question('canal', 'El número está registrado. ¿Qué falta aclarar?', [
        option('autorizar', 'Que el canal y la gestión cumplan el protocolo de contacto autorizado.', true, 'El registro del número no sustituye la validación del protocolo vigente.'),
        option('cualquiera', 'Nada: cualquier canal y cualquier momento sirven.', false, 'Las condiciones de contacto requieren validación interna; no se pueden inventar.'),
        option('tercero', 'Pedir a un tercero que reciba la información de la obligación.', false, 'No se debe divulgar información del caso a terceros para resolver esta duda.'),
      ]),
      question('opciones', 'La ficha de alternativas no muestra aprobación. ¿Qué haces?', [
        option('consultar', 'Consultar cuáles opciones están autorizadas para este caso.', true, 'Confirma el alcance de la autorización antes de ofrecer condiciones.'),
        option('copiar', 'Copiar el descuento que apareció en otra cuenta.', false, 'Las condiciones de una cuenta no se trasladan a otra sin autorización.'),
        option('inventar', 'Ofrecer un plazo nuevo para iniciar la conversación.', false, 'No puedes prometer un plazo que no está aprobado.'),
      ]),
    ],
    expected: 'Verificar vigencia del saldo y abono reportado; revisar el historial, el protocolo de contacto y las alternativas autorizadas. Mantener explícitos los pendientes.',
  },
  {
    key: 'contacto', title: 'Inicio del contacto y escucha',
    objective: 'Iniciar con respeto, proteger la información y hacer preguntas para comprender la situación.',
    explanation: [
      'Preséntate siguiendo el guion que la organización apruebe. Antes de compartir información del caso, verifica la identidad mediante el protocolo interno. Este curso no define preguntas, datos ni pasos de verificación.',
      'Escuchar es dejar que la persona explique y confirmar lo que entendiste. Usa preguntas abiertas y neutrales. Evita acusaciones, amenazas o promesas que no puedes cumplir.',
      'Si la identidad no se verifica, no reveles la obligación. Aplica la ruta interna correspondiente y registra el resultado de forma objetiva.',
    ],
    example: { title: 'Conversación ficticia · Después de verificar la identidad', paragraphs: [
      'Cliente: «Este mes tuve un gasto inesperado». Asesor: «Entiendo que ese gasto cambió tu situación. ¿Qué posibilidad de pago ves en este momento?».',
      'Cliente: «Tal vez tenga $200.000 el día 20». Asesor: «Para asegurarme de entender: esa sería tu posibilidad, todavía no un pago realizado. Voy a revisar qué alternativas autorizadas se ajustan».',
    ] },
    validation: ['Validación interna: guion de presentación, datos y método de verificación de identidad y tratamiento de una verificación fallida.', 'Los ejemplos de escucha son didácticos. Deben ajustarse al guion aprobado antes de usarlos en una gestión real.'],
    exercise: 'Elige una apertura segura y completa la conversación con respuestas de escucha activa.',
    questions: [
      question('apertura', 'Todavía no has verificado la identidad. Elige la apertura adecuada.', [
        option('protocolo', 'Presentarme con el guion aprobado e iniciar la verificación, sin revelar la obligación.', true, 'Proteges la información y sigues un protocolo que debe estar aprobado internamente.'),
        option('saldo', 'Anunciar de inmediato el saldo y los días de mora.', false, 'Compartir esos datos antes de verificar identidad expone información del caso.'),
        option('presion', 'Exigir un pago inmediato para que la persona se identifique.', false, 'La presión no reemplaza la verificación ni una comunicación respetuosa.'),
      ]),
      question('escucha', 'Cliente: «Tuve un gasto inesperado». Tú respondes…', [
        option('comprender', 'Entiendo. ¿Cómo afecta ese gasto tu posibilidad de pago?', true, 'Reconoces la situación y haces una pregunta para comprenderla.'),
        option('juzgar', 'Eso es una excusa; debe pagar como sea.', false, 'El juicio cierra la conversación y no aporta información útil.'),
        option('descuento', 'Entonces le garantizo un descuento.', false, 'Escuchar no autoriza a prometer condiciones no aprobadas.'),
      ], 'select'),
      question('aclarar', 'Cliente: «Tal vez pueda abonar algo». Tú preguntas…', [
        option('posibilidad', '¿Qué monto y qué fecha considera posibles?', true, 'La pregunta ayuda a concretar una posibilidad sin convertirla en pago.'),
        option('hecho', '¿Confirmamos entonces que ya pagó?', false, 'Hablar de una posibilidad no demuestra un pago realizado.'),
        option('imponer', 'Anotaré una fecha sin preguntarle.', false, 'Un compromiso debe reflejar lo conversado, no lo que el asesor supone.'),
      ], 'select'),
      question('identidad', 'La identidad no pudo verificarse. ¿Qué corresponde?', [
        option('reservar', 'Mantener la información reservada y seguir la ruta interna de verificación fallida.', true, 'El manejo específico requiere protocolo interno; la obligación no se divulga.'),
        option('familia', 'Explicar el saldo a quien conteste para que dé el mensaje.', false, 'Un tercero no queda autorizado a recibir información por contestar el contacto.'),
        option('continuar', 'Continuar con los datos financieros para ganar tiempo.', false, 'La rapidez no sustituye la verificación.'),
      ]),
    ],
    expected: 'Elegir la presentación con protocolo, reconocer la situación, preguntar por monto y fecha posibles y reservar los datos si no se verifica la identidad.',
  },
  {
    key: 'alternativas', title: 'Exploración de alternativas',
    objective: 'Comparar la posibilidad del cliente con las opciones permitidas y reconocer cuándo consultar.',
    explanation: [
      'Primero comprende qué puede hacer la persona. Después compara esa posibilidad con las alternativas autorizadas para el caso. Explica únicamente las condiciones que estén confirmadas.',
      'Si una solicitud queda fuera de lo permitido o la autorización no es clara, consulta al coordinador. La consulta no garantiza aprobación. Diferencia «voy a consultar» de «está aprobado».',
      'Las cantidades y opciones de este ejercicio son inventadas para aprender. No son descuentos, plazos ni políticas de Fontana.',
    ],
    example: { title: 'Caso ficticio · Opción aprobada solo para este ejercicio', paragraphs: [
      'Saldo ficticio: $480.000. Ficha didáctica: permite proponer un abono de $200.000 el 20 de noviembre de 2026 y revisar después el saldo pendiente. No incluye descuentos ni modificación del saldo.',
      'Camila indica que puede abonar $200.000 en esa fecha. Si después informa que solo puede $100.000 o pide una rebaja, esa solicitud no está cubierta por la ficha ficticia: se consulta, sin prometer aprobación.',
    ] },
    validation: ['Validación interna: alternativas, montos, fechas, condiciones, aprobaciones y facultades del asesor para cada cartera.', 'Validación interna: responsable, canal y pasos de consulta al coordinador. El curso no fija tiempos de respuesta ni garantiza aprobación.'],
    exercise: 'Resuelve el caso usando únicamente la autorización ficticia descrita en la ficha.',
    questions: [
      question('opcion', 'Camila puede abonar $200.000 el 20 de noviembre. ¿Qué alternativa puedes explorar en este caso ficticio?', [
        option('autorizada', 'La opción descrita en la ficha, explicando que el saldo restante sigue pendiente.', true, 'Coincide con la autorización del ejercicio y no inventa una cancelación total.'),
        option('rebaja', 'Ofrecer una rebaja para cerrar el caso ese mismo día.', false, 'La ficha no autoriza descuentos. No debes inventarlos.'),
        option('cancelar', 'Asegurar que el abono cancela toda la obligación.', false, 'El abono es parcial. La ficha no autoriza cancelar el saldo restante.'),
      ]),
      question('limite', 'Ahora Camila dice que solo puede $100.000 y pide un descuento. ¿Qué haces?', [
        option('consultar', 'Registrar su posibilidad y consultar al coordinador, aclarando que todavía no hay aprobación.', true, 'La solicitud sale de la ficha. Consultar conserva la información sin prometer un resultado.'),
        option('aprobar', 'Aprobar la solicitud para no perder el contacto.', false, 'El interés por continuar no amplía tus facultades.'),
        option('garantizar', 'Decir que el coordinador seguramente aceptará.', false, 'Una aprobación probable sigue siendo una condición no confirmada.'),
      ]),
      question('confirmacion', '¿Qué frase comunica correctamente el estado de esa consulta?', [
        option('pendiente', 'Voy a consultar la opción; por ahora no puedo confirmarla como aprobada.', true, 'Distingues la gestión de consulta de la decisión de aprobación.'),
        option('listo', 'El descuento ya quedó aprobado.', false, 'No existe esa aprobación en el caso.'),
        option('promesa', 'Pague primero y yo garantizo el cambio después.', false, 'No puedes garantizar una modificación que aún no está autorizada.'),
      ]),
    ],
    expected: 'Explorar el abono autorizado de la ficha ficticia; ante una solicitud distinta, registrar y consultar sin prometer descuentos, cancelaciones ni aprobación.',
  },
  {
    key: 'seguimiento', title: 'Cierre y seguimiento',
    objective: 'Resumir el resultado y dejar una nota clara con compromisos, pendientes y próxima acción.',
    explanation: [
      'Cierra resumiendo lo conversado. Confirma con la persona el monto, la fecha y el alcance de un compromiso. Distingue lo que acordaron de una posibilidad que aún no se concretó.',
      'La nota debe permitir que otra persona comprenda la gestión: resultado, información reportada, compromiso, pendientes y siguiente acción. Escribe hechos; evita juicios o suposiciones.',
      'No registres un pago confirmado mientras falte la verificación autorizada. La siguiente acción se programa según el procedimiento interno, sin inventar horarios ni reglas de contacto.',
    ],
    example: { title: 'Cierre ficticio · Camila confirma su compromiso', paragraphs: [
      'Después de verificar la identidad según el protocolo, Camila confirma: «Me comprometo a abonar $200.000 el 20 de noviembre de 2026». No hay pago confirmado durante esta conversación.',
      'Nota de ejemplo: «Se conversó con la titular tras verificar identidad. Confirma compromiso de abono de $200.000 para el 20/11/2026. Sin pago confirmado. Pendiente verificar recepción y aplicación en la fuente autorizada. Próxima acción: seguimiento del compromiso según procedimiento interno».',
    ] },
    validation: ['Validación interna: tipificaciones, campos obligatorios y lugar de registro de la gestión.', 'Validación interna: fuente de confirmación del pago, programación y canales autorizados de seguimiento.'],
    exercise: 'Completa las partes de la nota de gestión y corrige un registro que confunde compromiso con pago.',
    questions: [
      question('resultado', 'Resultado de la gestión:', [
        option('compromiso', 'Compromiso de abono; sin pago confirmado.', true, 'Refleja el acuerdo futuro y deja claro que todavía no hay pago confirmado.'),
        option('pago', 'Pago confirmado por $200.000.', false, 'La conversación solo establece un compromiso futuro.'),
        option('cerrado', 'Obligación cancelada por completo.', false, 'No hay evidencia de cancelación ni de pago total.'),
      ], 'select'),
      question('detalle', 'Compromiso confirmado por la cliente:', [
        option('exacto', '$200.000 para el 20/11/2026, como abono parcial.', true, 'La nota conserva monto, fecha y alcance del compromiso ficticio.'),
        option('cambiar', '$480.000 hoy, porque corresponde al saldo de la ficha.', false, 'El saldo no es el monto que la cliente se comprometió a abonar.'),
        option('vago', 'Pagará algo algún día.', false, 'Se pierde la información concreta que sí se confirmó.'),
      ], 'select'),
      question('pendiente', 'Pendiente que debes registrar:', [
        option('verificar', 'Verificar recepción y aplicación del pago en la fuente autorizada cuando corresponda.', true, 'La verificación sigue pendiente y debe distinguirse del compromiso.'),
        option('ninguno', 'Ninguno: una promesa equivale a pago.', false, 'El compromiso no elimina la necesidad de verificar el pago.'),
        option('descontar', 'Aplicar una rebaja no aprobada.', false, 'No se ha autorizado una rebaja y no corresponde inventarla.'),
      ], 'select'),
      question('accion', 'Próxima acción:', [
        option('seguimiento', 'Seguimiento del compromiso según procedimiento y canal autorizados.', true, 'La acción guarda relación con el pendiente y remite a la regla interna real.'),
        option('insistir', 'Contactar sin límite hasta obtener un pago.', false, 'No puedes crear reglas de frecuencia de contacto.'),
        option('omitir', 'Cerrar la gestión sin registrar seguimiento.', false, 'Dejas un pendiente sin próxima acción identificable.'),
      ], 'select'),
      question('corregir', 'Corrige «La cliente pagó $200.000 porque prometió hacerlo el día 20».', [
        option('correcta', 'La cliente confirma compromiso de abono de $200.000 para el 20/11/2026. Sin pago confirmado; queda pendiente verificarlo.', true, 'La corrección conserva el compromiso y elimina la afirmación de pago no verificada.'),
        option('parcial', 'Pago confirmado, pendiente de que la cliente lo realice.', false, 'Es contradictorio confirmar un pago que todavía no se realiza.'),
        option('borrar', 'Borrar el compromiso y dejar solo «se contactó».', false, 'La nota perdería información relevante y no permitiría un buen seguimiento.'),
      ]),
    ],
    expected: 'Nota esperada: compromiso de abono parcial de $200.000 para el 20/11/2026; sin pago confirmado; pendiente verificar recepción y aplicación; seguimiento según procedimiento autorizado.',
  },
];

export function publicBlock(block: CollectionsBlock) {
  const { expected: _expected, ...content } = block;
  return { ...content, workedExample: WORKED_EXAMPLES[block.key], questions: block.questions.map((item) => ({ ...item, hint: questionHint(block.key, item.key), options: item.options.map(({ id, text }) => ({ id, text })) })) };
}

const WORKED_EXAMPLES: Record<CollectionsKey, { decision: string; why: string }> = {
  conceptos: { decision: 'Registrar un compromiso de abono de $200.000 para el 20/11/2026. Mantener el saldo informado hasta verificar un pago.', why: 'Camila habla de una acción futura. Prometer un pago no demuestra que el dinero se haya recibido y aplicado.' },
  preparacion: { decision: 'Aclarar la vigencia del saldo y el abono reportado; revisar historial, protocolo de contacto y aprobación de alternativas.', why: 'La ficha tiene información incompleta. Preparar la gestión consiste en identificar esos pendientes, sin suponer lo que falta.' },
  contacto: { decision: 'Presentarse con el guion aprobado y verificar identidad. Después, reconocer la situación y preguntar qué monto y fecha considera posibles.', why: 'Primero se protege la información. Luego se escucha para comprender, sin juzgar ni prometer condiciones.' },
  alternativas: { decision: 'Si puede abonar $200.000 el día 20, explorar esa opción de la ficha ficticia. Si solicita otra condición, consultar sin prometer aprobación.', why: 'La autorización didáctica tiene un alcance concreto. La dificultad del cliente no amplía las facultades del asesor.' },
  seguimiento: { decision: 'Anotar compromiso parcial de $200.000 para el 20/11/2026; sin pago confirmado; verificación pendiente y seguimiento según el procedimiento autorizado.', why: 'Otra persona debe poder distinguir lo acordado, lo que falta verificar y la próxima acción.' },
};

function questionHint(block: CollectionsKey, questionKey: string): string {
  const conceptsHints: Record<string, string> = {
    cartera: 'Piensa en varias cuentas que se gestionan, no en el valor de una sola cuenta.',
    saldo: 'Busca un valor de dinero, no una fecha ni una situación de atraso.',
    vencimiento: 'Piensa en la fecha en la que se debía cumplir el pago.',
    mora: 'Compara la fecha de pago con lo que todavía está pendiente.',
    abono: 'No siempre se paga toda la deuda en una sola operación.',
    compromiso: 'Distingue lo que la persona hará de lo que ya ocurrió.',
    pago: 'Busca una verificación en la fuente autorizada, no solo una afirmación.',
    promesa: '¿El dinero ya fue verificado o se anunció para más adelante?',
  };
  if (block === 'conceptos') return conceptsHints[questionKey] ?? 'Revisa si se trata de dinero, una fecha o una acción futura.';
  if (block === 'preparacion') return 'Separa los datos confirmados de los pendientes. No completes información con suposiciones.';
  if (block === 'contacto') return 'Protege la información y elige una respuesta que permita comprender, sin juzgar ni prometer.';
  if (block === 'alternativas') return 'Compara la solicitud con la ficha ficticia: solo permite el abono indicado y no autoriza descuentos.';
  return 'Registra hechos y compromisos por separado. Un pago futuro todavía necesita verificación.';
}

export function reviewCollections(block: CollectionsBlock, answers: Record<string, string>) {
  const results = block.questions.flatMap((q) => {
    const selected = q.options.find((option) => option.id === answers[q.key]);
    return selected ? [{ key: q.key, correct: selected.correct, selected: selected.id, feedback: selected.feedback,
      options: q.options.map(({ id, text, correct, feedback }) => ({ id, text, correct, feedback })) }] : [];
  });
  const correctKeys = results.filter((result) => result.correct).map((result) => result.key);
  const passed = correctKeys.length === block.questions.length;
  return { passed, correctKeys, correctCount: correctKeys.length, total: block.questions.length, expected: passed ? block.expected : null, results };
}

export function mergeCollectionsAnswers(block: CollectionsBlock, previous: Record<string, string>, incoming: Record<string, string>) {
  if (Object.keys(incoming).some((key) => !block.questions.some((q) => q.key === key && q.options.some((o) => o.id === incoming[key])))) {
    throw new Error('Selecciona una respuesta disponible para esta pregunta.');
  }
  return Object.fromEntries(block.questions.flatMap((q) => {
    const known = q.options.find((option) => option.id === previous[q.key]);
    const answer = known?.correct ? known.id : incoming[q.key] ?? known?.id;
    return answer ? [[q.key, answer]] : [];
  }));
}

export function gradeCollections(block: CollectionsBlock, answers: Record<string, string>) {
  if (Object.keys(answers).length !== block.questions.length || block.questions.some((q) => !q.options.some((o) => o.id === answers[q.key]))) {
    throw new Error('Responde todas las preguntas con una de las opciones disponibles.');
  }
  const results = block.questions.map((q) => {
    const selected = q.options.find((o) => o.id === answers[q.key])!;
    return { key: q.key, correct: selected.correct, selected: selected.id, feedback: selected.feedback,
      options: q.options.map(({ id, text, correct, feedback }) => ({ id, text, correct, feedback })) };
  });
  return { passed: results.every((item) => item.correct), correctCount: results.filter((item) => item.correct).length, total: results.length, expected: block.expected, results };
}
