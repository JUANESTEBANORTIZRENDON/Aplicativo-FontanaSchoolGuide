// Catálogos ficticios del simulador.

import type {
  Advisor,
  ObligationStatus,
  PauseReason,
  Priority,
  ProfileCode,
  ResultCode,
  SortField,
} from '../types/simulator';

export const BRAND_NAME = 'Centro de Gestión Formativa';

/** Credenciales de práctica. No corresponden a ninguna cuenta real. */
export const DEMO_CREDENTIALS = {
  document: '1000000000',
  password: 'Practica2026',
} as const;

/** Asesor con el que se practica. */
export const PRACTICE_ADVISOR = {
  username: 'asesor.practica',
  firstName: 'Asesor en Formación',
  lastNames: 'Práctica Fontana',
  role: 'Asesor de cobranzas (práctica)',
  email: 'asesor.practica@ejemplo.test',
  document: DEMO_CREDENTIALS.document,
  extension: '00000',
  phone: '300 555 0100',
} as const;

export const ADVISORS: Advisor[] = [
  { username: PRACTICE_ADVISOR.username, firstName: PRACTICE_ADVISOR.firstName, lastNames: PRACTICE_ADVISOR.lastNames },
  { username: 'asesor.demo02', firstName: 'Andrea', lastNames: 'Demo Uno' },
  { username: 'asesor.demo03', firstName: 'Mateo', lastNames: 'Demo Dos' },
  { username: 'asesor.demo04', firstName: 'Valentina', lastNames: 'Demo Tres' },
  { username: 'asesor.demo05', firstName: 'Sebastián', lastNames: 'Demo Cuatro' },
];

export const CITIES = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Bucaramanga', 'Pereira'] as const;

export const PRODUCTS = [
  'Crédito de consumo',
  'Tarjeta de crédito',
  'Crédito de libranza',
  'Servicio residencial',
  'Compra a plazos',
] as const;

export interface ResultMeta {
  code: ResultCode;
  label: string;
  /** Jerarquía: menor es mejor. */
  rank: number;
  group: 'promesa' | 'contacto' | 'sin-contacto';
}

/** Tipificaciones en orden de jerarquía (de mejor a peor). */
export const RESULTS: ResultMeta[] = [
  { code: 'promesa-pago', label: 'Promesa de pago', rank: 1, group: 'promesa' },
  { code: 'contactado', label: 'Contactado', rank: 2, group: 'contacto' },
  { code: 'devolucion-llamada', label: 'Solicita devolución de llamada', rank: 3, group: 'contacto' },
  { code: 'no-contesta', label: 'No contesta', rank: 4, group: 'sin-contacto' },
  { code: 'numero-invalido', label: 'Número inválido', rank: 5, group: 'sin-contacto' },
];

export const PROFILE_OPTIONS: { code: ProfileCode; label: string }[] = [
  ...RESULTS.map(({ code, label }) => ({ code, label })),
  { code: 'sin-gestion', label: 'Sin gestión' },
];

const PROFILE_RANK: Record<ProfileCode, number> = {
  'promesa-pago': 1,
  contactado: 2,
  'devolucion-llamada': 3,
  'no-contesta': 4,
  'numero-invalido': 5,
  'sin-gestion': 6,
};

export function profileRank(code: ProfileCode): number {
  return PROFILE_RANK[code];
}

export function profileLabel(code: ProfileCode): string {
  return PROFILE_OPTIONS.find((p) => p.code === code)?.label ?? code;
}

export function resultMeta(code: ResultCode): ResultMeta {
  const meta = RESULTS.find((r) => r.code === code);
  if (!meta) throw new Error(`Tipificación desconocida: ${code}`);
  return meta;
}

export const PRIORITIES: { code: Priority; label: string }[] = [
  { code: 'alta', label: 'Alta' },
  { code: 'media', label: 'Media' },
  { code: 'baja', label: 'Baja' },
];

export const OBLIGATION_STATUSES: { code: ObligationStatus; label: string }[] = [
  { code: 'pendiente', label: 'Pendiente' },
  { code: 'en-acuerdo', label: 'En acuerdo' },
  { code: 'pagada', label: 'Pagada' },
  { code: 'escalada', label: 'Escalada' },
];

export function obligationStatusLabel(code: ObligationStatus): string {
  return OBLIGATION_STATUSES.find((s) => s.code === code)?.label ?? code;
}

export const SORT_FIELDS: { code: SortField; label: string }[] = [
  { code: 'nombre', label: 'Nombre' },
  { code: 'mora', label: 'Días de mora' },
  { code: 'saldo', label: 'Saldo' },
  { code: 'fecha-gestion', label: 'Fecha de gestión' },
  { code: 'promesas', label: 'Total promesas' },
];

export const PAUSE_REASONS: PauseReason[] = ['Descanso', 'Almuerzo', 'Capacitación'];

/** Duración de la sesión ficticia (igual que Fontana School). */
export const SESSION_HOURS = 8;
