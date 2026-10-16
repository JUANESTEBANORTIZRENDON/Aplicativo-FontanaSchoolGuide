// Contenido formativo del módulo (todo ficticio). Se entrega por la API: el navegador solo lo muestra.
// Las imágenes se suben una sola vez desde el panel (ver docs-assets/ofimatica/IMAGENES.md).

export type OfficeImage = { key: string; alt: string; width: number; height: number; caption: string };

export const OFFICE_IMAGES: Record<string, OfficeImage> = {
  'excel-filtro.webp': { key: 'excel-filtro.webp', alt: 'Ilustración de una hoja de cálculo con una columna filtrada por empresa y un cliente resaltado.', width: 1280, height: 720, caption: 'Filtrar una columna deja visibles solo los clientes de la empresa elegida.' },
  'excel-seguimiento.webp': { key: 'excel-seguimiento.webp', alt: 'Ilustración de una tabla de seguimiento con fechas ordenadas de la más próxima a la más lejana.', width: 1280, height: 720, caption: 'Ordenar por fecha pone primero la llamada que vence antes.' },
  'excel-formula.webp': { key: 'excel-formula.webp', alt: 'Ilustración de una celda con una fórmula de resta entre dos columnas y el total sumado al final.', width: 1280, height: 720, caption: 'Una fórmula calcula el faltante sin que tengas que hacer la cuenta a mano.' },
  'orto-homofonas.webp': { key: 'orto-homofonas.webp', alt: 'Ilustración con pares de palabras que suenan igual pero se escriben distinto, como a ver y haber.', width: 1280, height: 720, caption: 'Suenan igual, pero significan cosas distintas.' },
  'orto-tildes.webp': { key: 'orto-tildes.webp', alt: 'Ilustración de pares de palabras con y sin tilde, como tú y tu o él y el.', width: 1280, height: 720, caption: 'La tilde diacrítica cambia el significado de la palabra.' },
  'orto-observacion.webp': { key: 'orto-observacion.webp', alt: 'Ilustración de una observación de cobranza redactada con claridad en una pantalla de gestión.', width: 1280, height: 720, caption: 'Una observación clara se escribe con palabras correctas y frases cortas.' },
};

export type Lesson = {
  key: string;
  title: string;
  summary: string;
  rule: string;
  incorrect: string;
  correct: string;
  image: string;
};

export const WELCOME = {
  title: 'Ofimática para tus cobranzas',
  intro: 'En este módulo vas a practicar tres habilidades que usarás todos los días: escribir con rapidez y precisión, mover datos en una hoja de cálculo y redactar observaciones sin errores.',
  expectedMinutes: { min: 15, max: 20 },
  steps: [
    { key: 'mecanografia', title: 'Mecanografía', text: 'Una prueba corta de escritura con un texto de atención al cliente.' },
    { key: 'excel', title: 'Excel para cobranzas', text: 'Cuatro microlecciones y una práctica con datos ficticios.' },
    { key: 'ortografia', title: 'Ortografía aplicada', text: 'Lecciones breves y un dictado corto con corrección inmediata.' },
  ],
  note: 'Al aprobar las tres partes recibes el sello del módulo y se habilita la Inducción a las cobranzas. Si algo no sale a la primera, puedes repetir según los intentos disponibles.',
} as const;

export const EXCEL_LESSONS: Lesson[] = [
  {
    key: 'busquedas', title: 'Búsquedas', image: 'excel-filtro.webp',
    summary: 'Ubica a un cliente por su cédula, nombre, teléfono, correo o empresa sin recorrer toda la hoja.',
    rule: 'Usa el filtro de la columna para dejar solo las filas que te interesan y la búsqueda para saltar directo a un dato.',
    incorrect: 'Revisar fila por fila hasta encontrar el cliente.',
    correct: 'Filtrar la columna Empresa y seleccionar al cliente que pide la instrucción.',
  },
  {
    key: 'volver', title: 'Volver a llamar', image: 'excel-seguimiento.webp',
    summary: 'Registra la fecha de seguimiento y ordena la tabla para atender primero la llamada más próxima.',
    rule: 'Cada devolución de llamada lleva cliente, fecha y hora. Después ordena la columna de fecha de menor a mayor.',
    incorrect: 'Dejar la llamada anotada sin fecha o en una tabla sin ordenar.',
    correct: 'Agregar la fila con su fecha y ordenar ascendente: la más próxima queda arriba.',
  },
  {
    key: 'acuerdos', title: 'Acuerdos', image: 'excel-seguimiento.webp',
    summary: 'Registra el valor, el estado y la fecha de un acuerdo de pago.',
    rule: 'Un acuerdo completo tiene valor, estado (Pendiente, Cumplido o Incumplido) y fecha.',
    incorrect: 'Registrar solo el valor y olvidar el estado y la fecha.',
    correct: 'Completar los tres campos tal como lo indica el caso.',
  },
  {
    key: 'pagos', title: 'Pagos', image: 'excel-formula.webp',
    summary: 'Lee saldo, honorarios, meta y recaudo, y calcula el faltante y el total con fórmulas.',
    rule: 'Las fórmulas empiezan con =. El faltante es =H2-I2 (meta menos recaudo) y el total de saldos es =SUMA(C2:C500). El formato de moneda muestra los valores en pesos.',
    incorrect: 'Escribir el resultado a mano: si el dato cambia, el cálculo queda mal.',
    correct: 'Escribir la fórmula en la celda y aplicar formato de moneda COP.',
  },
];

export const SPELLING_LESSONS: Lesson[] = [
  {
    key: 'a-ver-haber', title: 'A ver / haber', image: 'orto-homofonas.webp',
    summary: '«A ver» sirve para mirar o pedir algo; «haber» es el verbo.',
    rule: 'Si puedes cambiarlo por «vamos a mirar», escribe «a ver». Si va con «de», «que haber» o un participio («haber pagado»), escribe «haber».',
    incorrect: 'El cliente dice que a ver pagado la semana pasada.',
    correct: 'El cliente dice que debe haber pagado la semana pasada.',
  },
  {
    key: 'hay-ahi-ay', title: 'Hay / ahí / ay', image: 'orto-homofonas.webp',
    summary: '«Hay» es del verbo haber; «ahí» señala un lugar; «ay» es una exclamación.',
    rule: '«Hay» equivale a «existe». «Ahí» equivale a «en ese lugar».',
    incorrect: 'Ahí un acuerdo de pago vigente. El soporte está hay.',
    correct: 'Hay un acuerdo de pago vigente. El soporte está ahí.',
  },
  {
    key: 'porque', title: 'Porque / por qué / porqué', image: 'orto-homofonas.webp',
    summary: 'Se escriben distinto según sean causa, pregunta o sustantivo.',
    rule: '«Porque» da la causa. «Por qué» pregunta. «El porqué» es el motivo (sustantivo).',
    incorrect: 'No pagó por que perdió el empleo. No sé porque no contestó.',
    correct: 'No pagó porque perdió el empleo. No sé por qué no contestó.',
  },
  {
    key: 'sino-si-no', title: 'Sino / si no', image: 'orto-homofonas.webp',
    summary: '«Sino» contrapone; «si no» es una condición.',
    rule: '«Sino» aparece después de una negación («no es X sino Y»). «Si no» equivale a «en caso de que no».',
    incorrect: 'No pagó el lunes si no el martes. Sino paga hoy, se reporta.',
    correct: 'No pagó el lunes sino el martes. Si no paga hoy, se reporta.',
  },
  {
    key: 'ha-a-hecho-echo', title: 'Ha / a y hecho / echo', image: 'orto-homofonas.webp',
    summary: '«Ha» es del verbo haber; «a» es preposición. «Hecho» viene de hacer; «echo» de echar.',
    rule: 'Si lo puedes cambiar por «había», es «ha». «Hecho» es lo que se hizo; «echo» es lo que se arroja.',
    incorrect: 'El cliente a pagado. Ya esta echo el registro.',
    correct: 'El cliente ha pagado. Ya está hecho el registro.',
  },
  {
    key: 'tildes-diacriticas', title: 'Tildes diacríticas', image: 'orto-tildes.webp',
    summary: 'Tú/tu, él/el, sí/si y mí/mi cambian de significado con la tilde.',
    rule: 'Con tilde son pronombres o afirmación («tú», «él», «sí», «mí»); sin tilde son artículo, posesivo o conjunción.',
    incorrect: 'Tu debes confirmar si el pago llegó. El cliente dijo que si.',
    correct: 'Tú debes confirmar si el pago llegó. El cliente dijo que sí.',
  },
  {
    key: 'errores-orales', title: 'Errores frecuentes al hablar', image: 'orto-observacion.webp',
    summary: 'Lo que se dice por costumbre no siempre se escribe igual.',
    rule: 'En la observación escribe la forma correcta: «dijiste», «fuiste», «haya», «hubo muchas personas».',
    incorrect: 'Dijistes que pagabas. Es posible que haiga un error. Hubieron muchas personas.',
    correct: 'Dijiste que pagabas. Es posible que haya un error. Hubo muchas personas.',
  },
];

export const EXCEL_LESSON_KEYS = EXCEL_LESSONS.map((lesson) => lesson.key);
export const SPELLING_LESSON_KEYS = SPELLING_LESSONS.map((lesson) => lesson.key);
