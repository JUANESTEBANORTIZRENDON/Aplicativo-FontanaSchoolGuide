// Módulo 03 «Enfréntate a la objeción». Conserva el slug técnico `simulador-cobranzas` para no romper
// prerrequisitos, historial ni progreso existentes; solo cambia el nombre visible.
export const OBJECTIONS_SLUG = 'simulador-cobranzas';
export const OBJECTIONS_NAME = 'Enfréntate a la objeción';
export const OBJECTIONS_ACTIVITY_TITLE = 'Enfréntate a la objeción: contenido del módulo';
// Versión de contenido propia del módulo: el progreso se guarda en la tabla genérica de bloques.
export const OBJECTIONS_VERSION = 1;
export const OBJECTIONS_KEYS = ['comprender', 'criterio', 'tipos', 'casos'] as const;
export type ObjectionsKey = typeof OBJECTIONS_KEYS[number];
// Módulo solo formativo (sin evaluaciones): cada bloque aporta 25 % y completar el cuarto cierra el módulo.
export const OBJECTIONS_BLOCK_PERCENT = 25;

export const OBJECTIONS_BLOCKS: { key: ObjectionsKey; title: string; objective: string }[] = [
  { key: 'comprender', title: 'Comprender la objeción', objective: 'Entender que una objeción es una duda o dificultad por comprender, y seguir una secuencia de seis pasos antes de responder.' },
  { key: 'criterio', title: 'Responder con criterio', objective: 'Responder con respeto y claridad, distinguiendo lo confirmado de lo reportado, lo que se debe verificar y lo que requiere autorización.' },
  { key: 'tipos', title: 'Tipos de cobranza', objective: 'Reconocer los cinco tipos de cobranza y cuáles hacen parte de la operación de Fontana.' },
  { key: 'casos', title: 'Casos frecuentes de objeciones', objective: 'Aplicar la secuencia en las objeciones más frecuentes, sin prometer lo que no está autorizado.' },
];
