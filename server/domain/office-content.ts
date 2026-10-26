// Contenido formativo del módulo (todo ficticio). Se entrega por la API: el navegador solo lo muestra.
// Las imágenes se suben una sola vez desde el panel (ver docs-assets/ofimatica/IMAGENES.md).

export type OfficeImage = { key: string; alt: string; width: number; height: number; caption: string };

export const OFFICE_IMAGES: Record<string, OfficeImage> = {
  'excel-busquedas.webp': { key: 'excel-busquedas.webp', alt: 'Excel con la ventana Buscar y reemplazar abierta y la columna Empresa filtrada.', width: 1280, height: 720, caption: 'Ctrl + B encuentra un dato; el filtro deja visibles solo las filas que necesitas.' },
  'excel-ordenar.webp': { key: 'excel-ordenar.webp', alt: 'Excel con la columna Fecha ordenada de más antiguo a más reciente.', width: 1280, height: 720, caption: 'Ordenar de forma ascendente deja arriba la fecha más próxima.' },
  'excel-formulas.webp': { key: 'excel-formulas.webp', alt: 'Excel con la fórmula =SUMA(B2:B6) en la barra de fórmulas y el total calculado.', width: 1280, height: 720, caption: 'Las fórmulas empiezan con = y se recalculan solas.' },
  'excel-atajos.webp': { key: 'excel-atajos.webp', alt: 'Teclas de los atajos básicos de Excel: copiar, pegar, cortar, deshacer, buscar y guardar.', width: 1280, height: 720, caption: 'Con seis atajos haces la mayor parte del trabajo diario.' },
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
    { key: 'excel', title: 'Excel para cobranzas', text: 'Cuatro microlecciones y cinco ejercicios en una hoja que se comporta como Excel: filtrar, ordenar, buscar, sumar y restar con fórmulas, y guardar. Si no apruebas, puedes activar un único reintento.' },
    { key: 'ortografia', title: 'Ortografía aplicada', text: 'Lecciones breves y un dictado corto con corrección inmediata.' },
  ],
  note: 'Al aprobar las tres partes recibes el sello del módulo y se habilita la Inducción a las cobranzas. Si algo no sale a la primera, puedes repetir según los intentos disponibles.',
} as const;

export const EXCEL_LESSONS: Lesson[] = [
  {
    key: 'busquedas', title: 'Buscar y filtrar', image: 'excel-busquedas.webp',
    summary: 'Encuentra a un cliente por su cédula, nombre o empresa sin recorrer toda la hoja.',
    rule: 'Ctrl + B abre Buscar: escribes el dato y Excel salta a la celda. Datos › Filtro agrega una flecha en cada encabezado para dejar visibles solo las filas que cumplen lo que eliges (por ejemplo, una empresa). El filtro no borra nada.',
    incorrect: 'Revisar fila por fila o borrar las filas que no sirven.',
    correct: 'Usar Ctrl + B para un dato puntual y el filtro de la columna para ver un grupo.',
  },
  {
    key: 'ordenar', title: 'Ordenar y listar', image: 'excel-ordenar.webp',
    summary: 'Organiza la lista para atender primero lo más urgente.',
    rule: 'Selecciona una celda de la tabla y usa Datos › Ordenar. Ascendente (A→Z, de más antiguo a más reciente) deja la fecha más próxima arriba; descendente hace lo contrario. Ordena siempre la tabla completa para que cada fila conserve sus datos.',
    incorrect: 'Ordenar una sola columna: los teléfonos quedan con otros clientes.',
    correct: 'Ordenar toda la tabla por la columna Fecha de forma ascendente.',
  },
  {
    key: 'formulas', title: 'Fórmulas básicas', image: 'excel-formulas.webp',
    summary: 'Suma y resta valores seleccionando las celdas con el mouse.',
    rule: 'Toda fórmula empieza con =. Para sumar, escribe =SUMA( y selecciona las celdas arrastrando el mouse. Para restar, escribe =, selecciona la primera celda, escribe - y selecciona la segunda. Pulsa Enter para calcular. Por ejemplo: =SUMA(B2:B4) o =B2-B3.',
    incorrect: 'Escribir el resultado a mano: si un dato cambia, el total queda mal.',
    correct: 'Escribir =SUMA(B2:B6) y dejar que Excel recalcule.',
  },
  {
    key: 'atajos', title: 'Atajos del teclado', image: 'excel-atajos.webp',
    summary: 'Los atajos que más usarás en Excel en español.',
    rule: 'Ctrl + C copia, Ctrl + V pega, Ctrl + X corta (quita el dato de su celda), Ctrl + Z deshace el último cambio, Ctrl + Y lo rehace, Ctrl + B busca y Ctrl + G guarda el libro.',
    incorrect: 'Volver a escribir un dato que borraste por error.',
    correct: 'Presionar Ctrl + Z para recuperarlo al instante.',
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
