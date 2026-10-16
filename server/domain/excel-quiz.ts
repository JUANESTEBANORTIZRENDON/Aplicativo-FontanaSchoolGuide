// Evaluación de Excel: preguntas de opción múltiple (A–D) sobre el uso básico de Excel en cobranzas,
// cada una con un caso ilustrado. La clave de respuestas solo vive en el servidor.

export type QuizOption = { id: 'a' | 'b' | 'c' | 'd'; text: string };
export type QuizQuestion = {
  id: string;
  lesson: string;
  image: string;
  prompt: string;
  options: QuizOption[];
  correct: QuizOption['id'];
  explanation: string;
};

export const EXCEL_QUIZ: QuizQuestion[] = [
  {
    id: 'suma', lesson: 'formulas', image: 'q-suma',
    prompt: 'En la imagen, los pagos del día están en las celdas B2 a B6. ¿Qué escribes en B7 para obtener el total?',
    options: [
      { id: 'a', text: '=SUMA(B2:B6)' },
      { id: 'b', text: 'SUMA(B2:B6)' },
      { id: 'c', text: '=SUMA(B2;B6)' },
      { id: 'd', text: '=B2+B6' },
    ],
    correct: 'a',
    explanation: 'Toda fórmula empieza con =. Los dos puntos (B2:B6) toman el rango completo; el punto y coma o el + solo suman B2 y B6.',
  },
  {
    id: 'resta', lesson: 'formulas', image: 'q-resta',
    prompt: 'La meta del cliente está en C2 y lo recaudado en D2. ¿Qué fórmula calcula cuánto falta?',
    options: [
      { id: 'a', text: '=D2-C2' },
      { id: 'b', text: '=C2-D2' },
      { id: 'c', text: '=C2+D2' },
      { id: 'd', text: '=SUMA(C2:D2)' },
    ],
    correct: 'b',
    explanation: 'Lo que falta es la meta menos lo recaudado: =C2-D2. Si cambian los datos, la fórmula se recalcula sola.',
  },
  {
    id: 'autosuma', lesson: 'formulas', image: 'q-autosuma',
    prompt: 'Tienes seleccionada la celda debajo de una columna de valores. ¿Qué hace el botón Σ Autosuma de la pestaña Inicio?',
    options: [
      { id: 'a', text: 'Ordena los valores de mayor a menor.' },
      { id: 'b', text: 'Borra los valores de la columna.' },
      { id: 'c', text: 'Escribe la fórmula =SUMA con el rango de arriba.' },
      { id: 'd', text: 'Cambia el formato a moneda.' },
    ],
    correct: 'c',
    explanation: 'Autosuma inserta =SUMA(...) tomando las celdas con números que están justo encima. Revisa el rango y presiona Enter.',
  },
  {
    id: 'filtro', lesson: 'busquedas', image: 'q-filtro',
    prompt: 'Necesitas ver solo los clientes de «Banco Andino». ¿Cuál es la forma correcta?',
    options: [
      { id: 'a', text: 'Borrar las filas de las otras empresas.' },
      { id: 'b', text: 'Ordenar la columna Empresa de la A a la Z.' },
      { id: 'c', text: 'Activar Datos › Filtro y en la columna Empresa dejar marcado solo «Banco Andino».' },
      { id: 'd', text: 'Copiar la tabla en otra hoja.' },
    ],
    correct: 'c',
    explanation: 'El filtro oculta temporalmente las filas que no cumplen la condición sin borrar nada. Para verlas todas, quita el filtro.',
  },
  {
    id: 'buscar', lesson: 'busquedas', image: 'q-buscar',
    prompt: 'Un cliente te da su cédula y debes encontrarlo en una hoja de 500 filas. ¿Qué atajo abre la ventana Buscar?',
    options: [
      { id: 'a', text: 'Ctrl + B' },
      { id: 'b', text: 'Ctrl + G' },
      { id: 'c', text: 'Ctrl + Z' },
      { id: 'd', text: 'Ctrl + P' },
    ],
    correct: 'a',
    explanation: 'En Excel en español, Ctrl + B abre Buscar y reemplazar: escribes la cédula y Excel salta a la celda.',
  },
  {
    id: 'ordenar', lesson: 'ordenar', image: 'q-ordenar',
    prompt: 'Quieres que la devolución de llamada más próxima quede de primera. ¿Cómo ordenas la columna Fecha?',
    options: [
      { id: 'a', text: 'De más antiguo a más reciente (ascendente).' },
      { id: 'b', text: 'De más reciente a más antiguo (descendente).' },
      { id: 'c', text: 'Con un filtro por color.' },
      { id: 'd', text: 'No se puede ordenar por fecha.' },
    ],
    correct: 'a',
    explanation: 'El orden ascendente pone primero la fecha más cercana. Ordena siempre toda la tabla para que cada fila conserve sus datos.',
  },
  {
    id: 'copiar', lesson: 'atajos', image: 'q-copiar',
    prompt: 'Debes llevar el teléfono de un cliente a otra celda sin borrarlo de la original. ¿Qué atajos usas?',
    options: [
      { id: 'a', text: 'Ctrl + X y luego Ctrl + V' },
      { id: 'b', text: 'Ctrl + C y luego Ctrl + V' },
      { id: 'c', text: 'Ctrl + Z y luego Ctrl + Y' },
      { id: 'd', text: 'Ctrl + B y luego Ctrl + G' },
    ],
    correct: 'b',
    explanation: 'Ctrl + C copia y Ctrl + V pega; el dato queda en las dos celdas. Ctrl + X corta: lo quita de la celda original.',
  },
  {
    id: 'deshacer', lesson: 'atajos', image: 'q-deshacer',
    prompt: 'Borraste por error el valor de un acuerdo de pago. ¿Qué atajo lo recupera de inmediato?',
    options: [
      { id: 'a', text: 'Ctrl + V' },
      { id: 'b', text: 'Ctrl + G' },
      { id: 'c', text: 'Ctrl + Z' },
      { id: 'd', text: 'Ctrl + B' },
    ],
    correct: 'c',
    explanation: 'Ctrl + Z deshace la última acción. Si te arrepientes de deshacer, Ctrl + Y la rehace.',
  },
  {
    id: 'guardar', lesson: 'atajos', image: 'q-guardar',
    prompt: 'Terminaste de registrar tus gestiones. ¿Qué atajo guarda el libro en Excel en español?',
    options: [
      { id: 'a', text: 'Ctrl + G' },
      { id: 'b', text: 'Ctrl + S' },
      { id: 'c', text: 'Ctrl + C' },
      { id: 'd', text: 'Ctrl + E' },
    ],
    correct: 'a',
    explanation: 'En Excel en español, Ctrl + G guarda. Guarda seguido para no perder lo que registraste.',
  },
  {
    id: 'moneda', lesson: 'formulas', image: 'q-moneda',
    prompt: 'Los saldos se ven como 1250000. ¿Cómo haces que se lean como pesos ($ 1.250.000)?',
    options: [
      { id: 'a', text: 'Escribir el signo $ a mano en cada celda.' },
      { id: 'b', text: 'Seleccionar las celdas y aplicar el formato Moneda desde Inicio › Número.' },
      { id: 'c', text: 'Multiplicar los valores por 1000.' },
      { id: 'd', text: 'Cambiar el ancho de la columna.' },
    ],
    correct: 'b',
    explanation: 'El formato Moneda solo cambia cómo se ve el número; el valor sigue siendo un número y las fórmulas siguen funcionando.',
  },
];

export type PublicQuestion = Omit<QuizQuestion, 'correct' | 'explanation'>;

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Orden de las preguntas por intento: la semilla lo hace reproducible para revisar el intento después.
export function quizFor(seed: number): QuizQuestion[] {
  const random = mulberry32(seed);
  const copy = [...EXCEL_QUIZ];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other]!, copy[index]!];
  }
  return copy;
}

// Lo que recibe el navegador: sin la respuesta correcta ni la explicación.
export function publicQuiz(seed: number): PublicQuestion[] {
  return quizFor(seed).map(({ correct: _correct, explanation: _explanation, ...rest }) => rest);
}

export type QuizAnswer = { questionId: string; optionId: string };
export type QuizStepResult = {
  questionId: string; lesson: string; correct: boolean; awardedScore: number; weight: number;
  chosen: string | null; correctOption: string; hint: string;
};

// Cada pregunta pesa lo mismo; la nota va de 0 a 100. Sin responder cuenta como incorrecta.
export function gradeQuiz(answers: QuizAnswer[], minScore: number): { score: number; passed: boolean; results: QuizStepResult[] } {
  const chosen = new Map(answers.map((answer) => [answer.questionId, answer.optionId]));
  const weight = 100 / EXCEL_QUIZ.length;
  const results = EXCEL_QUIZ.map((question) => {
    const pick = chosen.get(question.id) ?? null;
    const correct = pick === question.correct;
    return {
      questionId: question.id, lesson: question.lesson, correct, awardedScore: correct ? Number(weight.toFixed(2)) : 0, weight: Number(weight.toFixed(2)),
      chosen: pick, correctOption: question.correct, hint: question.explanation,
    };
  });
  const score = Number(((results.filter((result) => result.correct).length / EXCEL_QUIZ.length) * 100).toFixed(2));
  return { score, passed: score >= minScore, results };
}
