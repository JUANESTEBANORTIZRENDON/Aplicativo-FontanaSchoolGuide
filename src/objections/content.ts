import { escapar } from '../http';

// Contenido del módulo 03 «Enfréntate a la objeción», presentado como diapositivas. Todo es genérico y ficticio:
// no contiene nombres de clientes, marcas, sistemas internos ni datos de cartera reales. Usa «sistema autorizado»,
// «cartera asignada» y «procedimiento interno».
export type DeckSlide = {
  eyebrow?: string;
  title: string;
  icon: string;
  // Diapositiva estándar: idea principal, ejemplo ficticio y recordatorio.
  lead?: string;
  example?: string;
  reminder?: string;
  // Diapositiva libre: HTML ya escapado por quien la construye.
  html?: string;
  tone?: 'highlight' | 'excluded';
};

const icon = (paths: string) => `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const ICON = {
  chat: icon('<path d="M10 12h34v25H26L14 47V37h-4zM44 24h10v25h-8l-8 7v-7H27M18 22h18M18 29h11"/>'),
  steps: icon('<path d="M10 52h14V38h14V24h16V10"/><circle cx="10" cy="52" r="3"/><circle cx="24" cy="38" r="3"/><circle cx="38" cy="24" r="3"/><circle cx="54" cy="10" r="3"/>'),
  ear: icon('<path d="M22 28a12 12 0 1 1 24 0c0 8-6 9-6 16a8 8 0 0 1-15 3M28 28a5 5 0 0 1 10 0"/>'),
  search: icon('<circle cx="28" cy="28" r="16"/><path d="m40 40 14 14M22 28h12"/>'),
  check: icon('<circle cx="32" cy="32" r="22"/><path d="m21 32 8 8 15-16"/>'),
  shield: icon('<path d="M32 8 52 16v14c0 13-8 22-20 26-12-4-20-13-20-26V16zM23 32l6 6 12-13"/>'),
  ban: icon('<circle cx="32" cy="32" r="22"/><path d="m17 17 30 30"/>'),
  layers: icon('<path d="m32 10 24 12-24 12L8 22zM8 34l24 12 24-12M8 44l24 12 24-12"/>'),
  doc: icon('<path d="M14 8h28l8 8v40H14zM21 22h22M21 30h22M21 38h22M21 46h12"/>'),
  scale: icon('<path d="M32 10v44M14 54h36M12 22h40M12 22 6 38h12zM52 22l-6 16h12zM32 10l-4 4h8z"/>'),
  book: icon('<path d="M10 12h20a6 6 0 0 1 6 6v36a6 6 0 0 0-6-6H10zM54 12H38a6 6 0 0 0-6 6v36a6 6 0 0 1 6-6h16z"/>'),
};

const list = (items: string[], className = 'deck-list') => `<ul class="${className}">${items.map((entry) => `<li>${escapar(entry)}</li>`).join('')}</ul>`;

export type CaseCard = { quote: string; understand: string; validate: string; respond: string; avoid: string };
// Cada caso ocupa su diapositiva: cuatro recuadros grandes (comprender, validar, responder, no prometer).
const caseSlide = (group: string, entry: CaseCard, glyph: string): DeckSlide => ({
  eyebrow: `Caso · ${group}`, title: entry.quote, icon: glyph,
  html: `<div class="deck-case">
    <section><h4>Qué debes comprender</h4><p>${escapar(entry.understand)}</p></section>
    <section><h4>Qué debes validar</h4><p>${escapar(entry.validate)}</p></section>
    <section class="deck-case-say"><h4>Una forma correcta de responder</h4><p>${escapar(entry.respond)}</p></section>
    <section class="deck-case-avoid"><h4>Qué no debes asegurar ni prometer</h4><p>${escapar(entry.avoid)}</p></section></div>`,
});

const PROCESS_STEPS = [
  'Escuchar sin interrumpir.',
  'Validar la inquietud con respeto.',
  'Hacer una pregunta breve para entender el caso.',
  'Confirmar la información en la fuente autorizada.',
  'Dar una respuesta clara, dentro de lo permitido.',
  'Confirmar el siguiente paso o compromiso.',
];

export const OBJECTION_DECKS: Record<string, DeckSlide[]> = {
  comprender: [
    { eyebrow: 'Idea clave', title: 'Una objeción no es un ataque', icon: ICON.chat,
      lead: 'Es una duda, dificultad, inconformidad o situación que debes comprender antes de responder. No es una razón para discutir.',
      example: '«No me llamen más, estoy molesto». Detrás hay una inquietud que conviene entender.', reminder: 'Primero comprende; después responde.' },
    { eyebrow: 'El método', title: 'La secuencia de seis pasos', icon: ICON.steps,
      html: `<ol class="deck-steps">${PROCESS_STEPS.map((step) => `<li>${escapar(step)}</li>`).join('')}</ol>` },
    { eyebrow: 'Pasos 1 y 2', title: 'Escucha y valida', icon: ICON.ear,
      lead: 'Deja que la persona termine y reconoce su inquietud con respeto. Validar no es dar la razón ni quitársela: es mostrar que la escuchaste.',
      example: '«Entiendo que esta situación te preocupa. Gracias por contármelo».', reminder: 'Validar no es aceptar lo que se pide.' },
    { eyebrow: 'Pasos 3 y 4', title: 'Pregunta y confirma', icon: ICON.search,
      lead: 'Haz una pregunta breve para entender el caso y confirma la información en la fuente autorizada antes de explicarla.',
      example: '«¿Desde cuándo notas esa diferencia? Permíteme revisarlo en el sistema autorizado».', reminder: 'Una pregunta clara vale más que una suposición.' },
    { eyebrow: 'Pasos 5 y 6', title: 'Responde y acuerda el siguiente paso', icon: ICON.check,
      lead: 'Da una respuesta clara, dentro de lo permitido, y termina confirmando cuál es el siguiente paso o compromiso.',
      example: '«Esto es lo que aparece registrado. El siguiente paso es que revises el detalle y nos confirmes».', reminder: 'Cada conversación termina con un paso claro.' },
    { eyebrow: 'Importante', title: 'Lo que no se promete sin autorización', icon: ICON.ban, tone: 'highlight',
      html: `<p class="deck-lead">Sin autorización no se prometen ni se aseguran:</p>${list(['Descuentos.', 'Acuerdos.', 'Eliminación de cobros.', 'Cambios de saldo.', 'Suspensión de gestiones.'], 'deck-list deck-list--no')}<p class="deck-reminder">Si el cliente lo pide, consulta según el procedimiento interno y aclara que aún no está aprobado.</p>` },
  ],
  criterio: [
    { eyebrow: 'Idea clave', title: 'Responder con criterio', icon: ICON.chat,
      lead: 'Una buena respuesta es respetuosa, clara y profesional. Se adapta al caso: es un modelo, no un guion rígido.',
      example: '«Entiendo tu inquietud. Para orientarte correctamente, permíteme revisar la información disponible de tu obligación. Te confirmaré lo que aparece registrado y las opciones autorizadas para tu caso».',
      reminder: 'Con tus palabras, pero con la misma estructura.' },
    { eyebrow: 'Distinguir', title: 'Cuatro tipos de información', icon: ICON.layers,
      html: `<dl class="deck-kinds">
        <div><dt>Información confirmada</dt><dd>Aparece registrada en el sistema autorizado.</dd></div>
        <div><dt>Lo reportado por el cliente</dt><dd>Lo que la persona afirma. Se registra, pero no se da por cierto.</dd></div>
        <div><dt>Lo que debe verificarse</dt><dd>Lo que falta comprobar en la fuente autorizada.</dd></div>
        <div><dt>Solo con autorización interna</dt><dd>Lo que únicamente puede ofrecerse si está aprobado.</dd></div></dl>` },
    { eyebrow: 'Ejemplo', title: '¿Qué tipo de información es?', icon: ICON.search,
      html: `<ul class="deck-classify">
        <li><q>En el sistema autorizado aparece un saldo registrado.</q><strong>Confirmada</strong></li>
        <li><q>Dice que pagó ayer y no se ve el pago.</q><strong>Reportada · por verificar</strong></li>
        <li><q>Pide una rebaja para pagar hoy.</q><strong>Solo con autorización interna</strong></li></ul>` },
    { eyebrow: 'Tono', title: 'Un tono que genera confianza', icon: ICON.shield,
      html: `<div class="deck-do-dont"><div><h4>Sí</h4>${list(['Hablar con calma y respeto.', 'Explicar con frases claras y cortas.', 'Decir qué vas a revisar.', 'Reconocer lo que no puedes confirmar.'], 'deck-list deck-list--yes')}</div>
        <div><h4>Evitar</h4>${list(['Discutir o interrumpir.', 'Usar un tono de reproche.', 'Responder con suposiciones.', 'Prometer sin autorización.'], 'deck-list deck-list--no')}</div></div>` },
    { eyebrow: 'Lenguaje', title: 'Lenguaje neutral', icon: ICON.book,
      lead: 'Usa expresiones generales: «sistema autorizado», «cartera asignada» y «procedimiento interno».',
      example: '«Reviso en el sistema autorizado lo que figura en la cartera asignada».', reminder: 'Los detalles de cada cartera están en los lineamientos autorizados.' },
  ],
  tipos: [
    { eyebrow: 'Panorama', title: 'Los cinco tipos de cobranza', icon: ICON.layers, tone: 'highlight',
      html: `<ol class="deck-types"><li>Preventiva</li><li>Administrativa</li><li>Prejurídica</li><li>Castigada</li><li>Judicializada</li></ol>
        <p class="deck-callout" role="note"><strong>Importante:</strong> Fontana maneja cobranza administrativa, prejurídica, castigada y judicializada. La cobranza preventiva no hace parte de la operación de este módulo ni de la gestión actual de la empresa.</p>` },
    { eyebrow: 'Tipo 1 · fuera de la operación', title: 'Preventiva', icon: ICON.ban, tone: 'excluded',
      lead: 'Gestión anterior al vencimiento, que recuerda el pago para evitar la mora.',
      example: 'Se explica solo para que sepas diferenciarla: no se gestiona en Fontana.', reminder: 'No hace parte de la gestión actual de la empresa.' },
    { eyebrow: 'Tipo 2', title: 'Administrativa', icon: ICON.chat,
      lead: 'Gestión de obligaciones ya vencidas mediante contacto directo con el cliente, sin proceso judicial.',
      example: 'Camila tiene una obligación vencida: se le contacta para comprender su situación y orientarla.', reminder: 'Las condiciones de cada cartera se consultan en los lineamientos autorizados.' },
    { eyebrow: 'Tipo 3', title: 'Prejurídica', icon: ICON.doc,
      lead: 'Gestión que antecede a un proceso judicial: busca resolver la obligación antes de llegar a esa instancia.',
      example: 'Orientas al cliente según lo autorizado para esa etapa, sin anticipar decisiones.', reminder: 'No inventes plazos ni consecuencias: consúltalos en los lineamientos.' },
    { eyebrow: 'Tipo 4', title: 'Castigada', icon: ICON.scale,
      lead: 'Obligación que la entidad ya clasificó como de difícil recaudo y retiró de su cartera activa, pero que continúa existiendo.',
      example: 'Se gestiona únicamente con lo que indiquen los lineamientos autorizados de esa cartera.', reminder: 'No supongas condiciones: confírmalas.' },
    { eyebrow: 'Tipo 5', title: 'Judicializada', icon: ICON.scale,
      lead: 'Obligación cuya cobranza se encuentra en un proceso judicial.',
      example: 'Si el cliente pregunta por su proceso, orientas con lo autorizado y no opinas sobre decisiones judiciales.', reminder: 'No expliques consecuencias legales que no estén en los lineamientos.' },
    { eyebrow: 'Recuerda', title: 'Cada cartera tiene sus particularidades', icon: ICON.book,
      lead: 'Los plazos, reglas y condiciones de cada cartera no se deducen: se consultan en los lineamientos autorizados.',
      example: 'Ante una duda de plazos, revisas el procedimiento interno antes de responder.', reminder: 'Ante la duda, consulta; no supongas.' },
  ],
  casos: [
    { eyebrow: 'Cómo leer los casos', title: 'Trece objeciones frecuentes', icon: ICON.chat,
      lead: 'Cada caso se presenta igual: qué comprender, qué validar, una forma correcta de responder y qué no asegurar ni prometer.',
      example: 'Las respuestas son modelos neutrales: siempre quedan sujetas a la información y a las autorizaciones de cada cartera.', reminder: 'Adapta las palabras; conserva la estructura.' },
    ...([
      ['Contacto y frecuencia', ICON.chat, [
        { quote: '«Siempre pago antes de terminar el mes, no me llamen».',
          understand: 'Cree que su costumbre de pagar lo exime de ser contactado y le incomoda la gestión.',
          validate: 'La fecha de vencimiento y el estado de la obligación en el sistema autorizado.',
          respond: '«Agradezco que cumplas con tus pagos. Permíteme revisar en el sistema autorizado la fecha y el estado de tu obligación para orientarte».',
          avoid: 'No asegurar que dejarán de contactarlo ni prometer cambios en la gestión sin autorización.' },
        { quote: 'Se queja de llamadas o grabaciones frecuentes.',
          understand: 'Le molesta la cantidad de contactos o de mensajes grabados.',
          validate: 'Los lineamientos autorizados sobre la gestión de la cartera asignada y el historial registrado.',
          respond: '«Entiendo que estos contactos te resulten molestos. Voy a registrar tu inquietud y revisar la información disponible para orientarte».',
          avoid: 'No prometer reducir o suspender llamadas ni mensajes, ni dar cifras de frecuencia sin una fuente autorizada.' },
        { quote: 'Dice que ya informó su inconformidad a servicio al cliente.',
          understand: 'Expresó su inconformidad por otro canal y siente que no fue atendido.',
          validate: 'Si existe un registro de esa solicitud en el sistema autorizado y cuál es su estado.',
          respond: '«Gracias por informarlo. Voy a verificar si aparece registrada tu solicitud y te cuento lo que figure».',
          avoid: 'No asegurar que se resolverá a su favor ni dar plazos de respuesta que no estén confirmados.' },
      ]],
      ['Fechas y pagos', ICON.scale, [
        { quote: '«Mi fecha límite no coincide con el día en que me pagan la nómina».',
          understand: 'Su ingreso llega después de la fecha límite y eso le dificulta pagar a tiempo.',
          validate: 'La fecha límite registrada y las alternativas autorizadas para el caso.',
          respond: '«Entiendo que tu pago de nómina llega en otra fecha. Revisemos la fecha registrada y las opciones autorizadas para tu caso».',
          avoid: 'No cambiar ni prometer cambiar la fecha límite, ni ofrecer plazos que no estén autorizados.' },
        { quote: '«Ya hice un abono, ¿por qué me siguen llamando o escribiendo?»',
          understand: 'Hizo un abono y espera que ya no lo contacten.',
          validate: 'Que el abono figure aplicado y el saldo pendiente que aparece en el sistema autorizado.',
          respond: '«Gracias por tu abono. Verifico que figure aplicado y te confirmo el saldo pendiente que aparece registrado».',
          avoid: 'No asegurar que cesarán los contactos ni afirmar que el abono está aplicado sin verificarlo.' },
        { quote: '«Pagué hace poco y todavía no aparece».',
          understand: 'Pagó y le inquieta que el pago aún no se vea.',
          validate: 'Si el pago aparece en la fuente autorizada y qué soporte pide el procedimiento interno.',
          respond: '«Gracias por avisar. Reviso si el pago aparece registrado; si no, tomo tu reporte y lo dejo pendiente de verificación».',
          avoid: 'No confirmar que el pago está aplicado ni pedirle que pague de nuevo.' },
      ]],
      ['Facturas, reclamaciones y descuentos', ICON.doc, [
        { quote: '«Nunca me llegó la factura».',
          understand: 'Dice no conocer el detalle de lo que debe.',
          validate: 'El medio de envío y los datos de contacto registrados en el sistema autorizado.',
          respond: '«Entiendo. Reviso los datos registrados y te oriento sobre cómo obtener el detalle de tu obligación por el medio autorizado».',
          avoid: 'No enviar información por canales no autorizados ni asegurar fechas de entrega.' },
        { quote: '«Tengo una reclamación en curso, no voy a pagar mientras tanto».',
          understand: 'Tiene un reclamo abierto y no quiere pagar hasta que se resuelva.',
          validate: 'Si hay una reclamación registrada, su estado y cómo afecta la gestión según los lineamientos.',
          respond: '«Gracias por contarlo. Verifico si tu reclamación figura registrada y te comento lo que aparezca; el procedimiento interno indica los pasos a seguir».',
          avoid: 'No asegurar el resultado del reclamo ni prometer suspender la gestión sin autorización.' },
        { quote: '«¿Hay algún descuento si pago hoy?»',
          understand: 'Quiere saber si existe una rebaja para pagar.',
          validate: 'Las alternativas autorizadas para esa cartera y para ese caso.',
          respond: '«Voy a revisar las opciones autorizadas para tu caso y te cuento cuáles aplican; no puedo asegurarlas antes de verificarlas».',
          avoid: 'No prometer ni insinuar descuentos, ni inventar porcentajes o fechas límite.' },
      ]],
      ['Suspensión, desconexión o bloqueo', ICON.shield, [
        { quote: '«Si me comprometo a pagar, ¿no me suspenden o bloquean el servicio?»',
          understand: 'Quiere saber si, al comprometerse, su servicio seguirá activo.',
          validate: 'Qué indica la información autorizada sobre el estado del servicio y los compromisos de pago.',
          respond: '«Registraré tu compromiso de pago. Sobre el estado del servicio, te informo lo que aparezca en la información autorizada; no puedo asegurar cambios que no estén confirmados».',
          avoid: 'No asegurar que no habrá suspensión, desconexión o bloqueo, ni afirmar lo contrario sin una fuente.' },
        { quote: '«Si pago solo una parte, ¿evito que me desconecten o bloqueen?»',
          understand: 'Podría pagar una parte y pregunta si eso evita la medida.',
          validate: 'Qué dice la información autorizada sobre pagos parciales y estado del servicio.',
          respond: '«Entiendo tu situación. Reviso qué indica la información autorizada sobre un pago parcial y te lo explico sin adelantar resultados».',
          avoid: 'No asegurar que un pago parcial evita o levanta la medida sin una fuente autorizada.' },
      ]],
      ['Seguridad y servicio cancelado', ICON.search, [
        { quote: 'Recibió un mensaje externo que le ofrece refinanciar su deuda.',
          understand: 'Duda si el mensaje es legítimo; podría tratarse de un fraude.',
          validate: 'Si la información proviene de un canal oficial y lo que aparece en el sistema autorizado.',
          respond: '«Por seguridad, no compartas datos personales ni bancarios por enlaces o mensajes que no puedas verificar. Orientémonos por los canales oficiales».',
          avoid: 'No confirmar ofertas que no puedas validar ni pedirle sus datos por canales no verificados.' },
        { quote: '«Cancelé el servicio, no debo nada».',
          understand: 'Cree que al cancelar el servicio ya no queda nada pendiente.',
          validate: 'El saldo pendiente y su origen en el sistema autorizado.',
          respond: '«Entiendo la confusión. Reviso qué saldo aparece registrado y de dónde proviene para explicártelo con claridad».',
          avoid: 'No afirmar que el saldo desaparece, ni que se debe, sin revisar el detalle.' },
      ]],
    ] as [string, string, CaseCard[]][]).flatMap(([group, glyph, cases]) => cases.map((entry) => caseSlide(group, entry, glyph))),
  ],
};
