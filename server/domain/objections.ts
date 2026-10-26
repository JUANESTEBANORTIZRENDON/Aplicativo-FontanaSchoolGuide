import { OBJECTIONS_CASES, OBJECTIONS_CASE_KEYS } from './objections-expert.js';
export const OBJECTIONS_SLUG = 'simulador-cobranzas';
export const OBJECTIONS_NAME = 'Enfréntate a la objeción';
export const OBJECTIONS_ACTIVITY_TITLE = 'Objeciones: introducción a los cinco casos';
export const OBJECTIONS_VERSION = 2;
export const OBJECTIONS_KEYS = OBJECTIONS_CASE_KEYS;
export type ObjectionsKey = typeof OBJECTIONS_KEYS[number];
// Los sliders son informativos y no registran lectura. El sello requiere aprobar la evaluación.
export const OBJECTIONS_BLOCKS = OBJECTIONS_CASES.map(c => ({ key: c.key, title: c.title, objective: c.explain }));
export const OBJECTIONS_ATTEMPT_PREFIX = 'obj-intento-';
