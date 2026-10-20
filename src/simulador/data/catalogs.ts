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

import type { ContactType, ManagementAction } from '../types/simulator';

/** Nombre del aplicativo de gestión que se practica (clon de entrenamiento, sin conexión con el sistema real). */
export const BRAND_NAME = 'Control Next';

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
  role: 'Asesor de Cobranzas',
  email: 'asesor.practica@ejemplo.test',
  document: DEMO_CREDENTIALS.document,
  extension: '10500',
  phone: '300 555 0100',
} as const;

/**
 * Nombre que se muestra en el perfil. Fontana School lo envía en la URL del simulador (?nombre=…) para que el
 * asesor vea su propio nombre; sin él se usa el asesor ficticio.
 */
export function displayAdvisor(): { firstName: string; lastNames: string } {
  let name = '';
  try {
    name = new URLSearchParams(location.search).get('nombre')?.trim().slice(0, 80) ?? '';
  } catch {
    name = '';
  }
  if (!name) return { firstName: PRACTICE_ADVISOR.firstName, lastNames: PRACTICE_ADVISOR.lastNames };
  const words = name.split(/\s+/);
  const cut = Math.max(1, Math.min(2, words.length - 1));
  return { firstName: words.slice(0, cut).join(' '), lastNames: words.slice(cut).join(' ') };
}

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

/**
 * Tipificaciones («Efecto» en Control Next) en orden de jerarquía (de mejor a peor).
 * PROPUESTA DE PRÁCTICA: el catálogo oficial de efectos y motivos lo define la operación; ajústalo aquí.
 */
export const RESULTS: ResultMeta[] = [
  { code: 'promesa-pago', label: 'Acuerdo de pago', rank: 1, group: 'promesa' },
  { code: 'contactado', label: 'No hubo acuerdo', rank: 2, group: 'contacto' },
  { code: 'devolucion-llamada', label: 'Volver a llamar', rank: 3, group: 'contacto' },
  { code: 'no-contesta', label: 'No contesta', rank: 4, group: 'sin-contacto' },
  { code: 'numero-invalido', label: 'Número equivocado', rank: 5, group: 'sin-contacto' },
];

/** Efecto tal como aparece en el histórico (mayúsculas). */
export function effectLabel(code: ResultCode): string {
  return resultMeta(code).label.toUpperCase();
}

export const ACTIONS: { code: ManagementAction; label: string }[] = [
  { code: 'hacer-llamada', label: 'Hacer Llamada' },
  { code: 'recibir-llamada', label: 'Recibir Llamada' },
  { code: 'whatsapp', label: 'Mensaje WhatsApp' },
  { code: 'correo', label: 'Correo Electrónico' },
  { code: 'sms', label: 'Mensaje de Texto' },
];

export function actionLabel(code: ManagementAction | undefined): string {
  return ACTIONS.find((a) => a.code === code)?.label ?? 'Hacer Llamada';
}

export const CONTACTS: { code: ContactType; label: string; help: string }[] = [
  { code: 'directo', label: 'CONTACTO DIRECTO', help: 'Hablaste con el titular (TT).' },
  { code: 'indirecto', label: 'CONTACTO INDIRECTO', help: 'Contestó un tercero que conoce al titular.' },
  { code: 'sin-contacto', label: 'SIN CONTACTO', help: 'Nadie atendió o el número no es del titular.' },
];

export function contactLabel(code: ContactType | undefined): string {
  return CONTACTS.find((c) => c.code === code)?.label ?? 'SIN CONTACTO';
}

/** Motivo de no pago (Motivo N.P.) sugerido por efecto. Propuesta de práctica. */
export const REASONS: Record<ResultCode, string[]> = {
  'promesa-pago': ['CONFIRMAR PAGO', 'PAGO PARCIAL', 'PAGO TOTAL'],
  contactado: ['NO CUENTA CON EL DINERO', 'DESEMPLEADO', 'NO RECONOCE LA DEUDA', 'CONTESTA Y CUELGA', 'RECLAMACIÓN EN TRÁMITE'],
  'devolucion-llamada': ['TITULAR OCUPADO', 'LLAMAR MÁS TARDE'],
  'no-contesta': ['NO CONTESTA', 'BUZÓN DE VOZ', 'APAGADO'],
  'numero-invalido': ['NÚMERO EQUIVOCADO', 'NÚMERO NO EXISTE'],
};

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

export const PAUSE_REASONS: PauseReason[] = [
  'Almuerzo Teletrabajo',
  'BREAK AM',
  'ALMUERZO',
  'BREAK PM',
  'BAÑO',
  'CAPACITACIÓN',
  'RETROALIMENTACION',
  'PAUSA ACTIVAS',
];

/** Duración de la sesión ficticia (igual que Fontana School). */
export const SESSION_HOURS = 8;
