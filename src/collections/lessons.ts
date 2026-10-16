import { icon, type Slide } from './concepts-slider';

// Teoría de los bloques 02 a 05 en tarjetas cortas: una idea por tarjeta, un ejemplo y un recordatorio.
// El texto completo de cada bloque sigue disponible en «Leer la explicación completa».
export const LESSONS: Record<string, Slide[]> = {
  preparacion: [
    { title: 'Revisa la ficha', definition: 'Antes de contactar, mira cinco datos: identificación, saldo, vencimiento, historial y compromisos anteriores.', example: 'Ficha F-204: saldo $480.000, vence el 10/11/2026, un abono reportado de $80.000.', reminder: 'Fíjate en la fecha de actualización del saldo.',
      icon: icon('<path d="M16 8h24l10 10v38H16zM40 8v10h10M23 28h20M23 36h20M23 44h12"/>') },
    { title: 'Separa hechos y pendientes', definition: 'Ordena lo que sabes en tres grupos: confirmado, reportado por el cliente y pendiente de verificar.', example: '«Abono de $80.000» es un reporte: queda pendiente y no se resta del saldo.', reminder: 'Lo reportado no es lo mismo que lo confirmado.',
      icon: icon('<path d="M8 14h14v14H8zM25 14h14v14H25zM42 14h14v14H42zM12 21l3 3 5-6M29 21h6M46 18v6M46 26h.01M8 38h48M8 46h30"/>') },
    { title: 'Confirma qué puedes ofrecer', definition: 'Revisa las alternativas autorizadas para este caso. Lo que se aprobó en otra cuenta no se traslada.', example: 'La ficha de opciones no muestra aprobación: consultas antes de ofrecer algo.', reminder: 'Sin autorización visible, no hay oferta.',
      icon: icon('<path d="M32 8 52 16v14c0 13-8 22-20 26-12-4-20-13-20-26V16zM23 32l6 6 12-13"/>') },
    { title: 'Si falta algo, pregunta', definition: 'Cuando falta información para una gestión segura, acláralo por la vía interna correspondiente.', example: 'No sabes si el canal está autorizado: lo confirmas antes de usarlo.', reminder: 'Nunca completes vacíos con suposiciones.',
      icon: icon('<circle cx="32" cy="32" r="22"/><path d="M25 26a7 7 0 1 1 10 6c-2 1-3 3-3 5v2M32 45h.01"/>') },
  ],
  contacto: [
    { title: 'Saluda y preséntate', definition: 'Inicia con el guion aprobado: saludo, tu nombre y a quién representas.', example: '«Buenos días, habla Laura, asesora de Fontana».', reminder: 'Un buen inicio genera confianza.',
      icon: icon('<path d="m18 10 9 11-6 7c4 7 8 11 15 15l7-6 11 9-6 9C29 55 9 35 9 16zM39 11c8 1 13 6 14 14M38 19c4 0 7 3 7 7"/>') },
    { title: 'Verifica la identidad', definition: 'Antes de hablar de la deuda, verifica con el protocolo interno que hablas con el titular.', example: 'Contesta un familiar: no revelas la obligación y sigues la ruta interna.', reminder: 'Sin verificación, la información queda reservada.',
      icon: icon('<rect x="8" y="14" width="48" height="36" rx="5"/><circle cx="23" cy="30" r="6"/><path d="M14 43c2-5 5-7 9-7s7 2 9 7M38 26h12M38 33h12M38 40h7"/>') },
    { title: 'Escucha para comprender', definition: 'Deja que la persona explique. Usa preguntas abiertas y confirma lo que entendiste.', example: '«Entiendo que tuviste un gasto inesperado. ¿Qué posibilidad de pago ves?»', reminder: 'Primero comprende; después propón.',
      icon: icon('<path d="M10 12h34v25H26L14 47V37h-4zM44 24h10v25h-8l-8 7v-7H27M18 22h18M18 29h11"/>') },
    { title: 'Lo que debes evitar', definition: 'Acusar, amenazar, juzgar o prometer algo que no puedes cumplir.', example: '«Eso es una excusa» cierra la conversación y no aporta información.', reminder: 'Respeto y claridad en todo momento.',
      icon: icon('<circle cx="32" cy="32" r="22"/><path d="m17 17 30 30"/>') },
  ],
  alternativas: [
    { title: 'Primero, su posibilidad', definition: 'Pregunta qué monto y qué fecha considera posibles la persona.', example: 'Camila: «Puedo abonar $200.000 el 20 de noviembre».', reminder: 'Una posibilidad todavía no es un pago.',
      icon: icon('<path d="M32 10v44M14 54h36M12 22h40M12 22 6 38h12zM52 22l-6 16h12zM32 10l-4 4h8z"/>') },
    { title: 'Compárala con lo autorizado', definition: 'Revisa si esa posibilidad encaja en las alternativas permitidas y explica solo condiciones confirmadas.', example: 'La ficha ficticia permite ese abono: lo propones y aclaras que el resto sigue pendiente.', reminder: 'Explica únicamente lo que está aprobado.',
      icon: icon('<rect x="8" y="12" width="20" height="40" rx="4"/><rect x="36" y="12" width="20" height="40" rx="4"/><path d="M14 22h8M14 30h8M42 22h8M42 30h8M14 42l3 3 5-6M42 42l3 3 5-6"/>') },
    { title: 'Fuera de lo permitido: consulta', definition: 'Si pide algo no autorizado, registra la solicitud y consúltala con tu coordinador.', example: 'Pide un descuento: «Voy a consultarlo; por ahora no puedo confirmarlo».', reminder: '«Voy a consultar» no es «está aprobado».',
      icon: icon('<circle cx="22" cy="20" r="8"/><circle cx="44" cy="20" r="8"/><path d="M8 50c1-9 7-14 14-14s13 5 14 14M30 50c1-9 7-14 14-14s13 5 14 14M28 14l8 0"/>') },
  ],
  seguimiento: [
    { title: 'Resume y confirma', definition: 'Al cerrar, repasa con la persona el monto, la fecha y el alcance del compromiso.', example: '«Entonces, abonas $200.000 el 20 de noviembre. ¿Es correcto?»', reminder: 'Confirma lo acordado antes de despedirte.',
      icon: icon('<circle cx="32" cy="32" r="22"/><path d="m21 32 8 8 15-16"/>') },
    { title: 'Escribe una nota clara', definition: 'Registra cuatro partes: resultado, compromiso, pendiente y próxima acción. Hechos, no juicios.', example: '«Compromiso de abono de $200.000 para el 20/11/2026. Sin pago confirmado».', reminder: 'Otra persona debe entender la gestión al leerla.',
      icon: icon('<path d="M14 8h28l8 8v40H14zM21 22h22M21 30h22M21 38h22M21 46h12"/>') },
    { title: 'Una promesa no es un pago', definition: 'Mientras falte la verificación en la fuente autorizada, no registres un pago confirmado.', example: '«Ya pagué» queda como reporte del cliente, pendiente de verificar.', reminder: 'Confirmar el pago exige la fuente autorizada.',
      icon: icon('<circle cx="32" cy="34" r="20"/><path d="M32 22v12l8 6M26 8h12M32 8v6"/>') },
    { title: 'Programa el seguimiento', definition: 'Deja la próxima acción según el procedimiento interno, sin inventar horarios ni frecuencias.', example: 'Próxima acción: seguimiento del compromiso por el canal autorizado.', reminder: 'Cada pendiente necesita una próxima acción.',
      icon: icon('<rect x="8" y="12" width="48" height="42" rx="5"/><path d="M8 24h48M20 6v12M44 6v12M18 34h6M30 34h6M42 34h6M18 44h6M30 44h6"/>') },
  ],
};

// Ruta de la gestión: muestra en qué etapa del proceso está cada bloque.
export const PROCESS = [
  { key: 'conceptos', label: 'Conceptos' },
  { key: 'preparacion', label: 'Prepara' },
  { key: 'contacto', label: 'Contacta y escucha' },
  { key: 'alternativas', label: 'Explora alternativas' },
  { key: 'seguimiento', label: 'Cierra y registra' },
] as const;
