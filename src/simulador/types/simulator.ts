// Tipos compartidos del simulador. Todo dato es ficticio.

export type PortfolioId = string;

/** Estilo de la tarjeta de campaña: nombre en letra grande, «PROPIA» sobre el nombre o imagen de constelación. */
export type LogoShape = 'palabra' | 'propia' | 'imagen';

export interface Portfolio {
  id: PortfolioId;
  name: string;
  description: string;
  /** Color de acento del logo geométrico. */
  accent: string;
  logo: LogoShape;
  practiceStatus: 'Recomendada para iniciar' | 'Disponible' | 'Nivel intermedio' | 'Nivel avanzado';
  products: string[];
}

export interface Advisor {
  username: string;
  firstName: string;
  lastNames: string;
}

/** Tipificación de una gestión. */
export type ResultCode =
  | 'promesa-pago'
  | 'contactado'
  | 'devolucion-llamada'
  | 'no-contesta'
  | 'numero-invalido';

/** "Perfil" de un cliente: una tipificación o la ausencia de gestiones. */
export type ProfileCode = ResultCode | 'sin-gestion';

export type Priority = 'alta' | 'media' | 'baja';

export type ObligationStatus = 'pendiente' | 'en-acuerdo' | 'pagada' | 'escalada';

export type ManagementStatus = 'sin-gestion' | 'menos-5-dias' | 'mas-5-dias' | 'gestionado-hoy';

export interface Obligation {
  id: string;
  product: string;
  balance: number;
  daysPastDue: number;
  status: ObligationStatus;
}

export interface Customer {
  id: string;
  portfolioId: PortfolioId;
  document: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  advisor: string;
  priority: Priority;
  obligations: Obligation[];
}

/** Gestión registrada sobre un cliente. */
export interface Management {
  id: string;
  customerId: string;
  /** Fecha y hora ISO. */
  date: string;
  advisor: string;
  result: ResultCode;
  note: string;
  /** Fecha de compromiso `aaaa-mm-dd` (solo promesa de pago). */
  promiseDate?: string;
  promiseAmount?: number;
  /** Fecha y hora ISO de la nueva llamada (solo devolución de llamada). */
  callbackAt?: string;
  /** Campos de la ficha de Control Next. Las gestiones semilla los derivan del resultado. */
  action?: ManagementAction;
  contact?: ContactType;
  channel?: 'telefonico' | 'whatsapp' | 'correo';
  /** Perfil elegido en Control Next («Acuerdo de pago Abono», «No hubo acuerdo»…). */
  profile?: string;
  reason?: string;
  phone?: string;
  /** Duración de la gestión y de la llamada, en segundos. */
  managementSec?: number;
  callSec?: number;
}

export type ManagementAction = 'hacer-llamada' | 'recibir-llamada';
export type ContactType = 'directo' | 'indirecto' | 'sin-contacto';

export interface Payment {
  id: string;
  customerId: string;
  date: string;
  amount: number;
}

export interface CallRecord {
  id: string;
  customerId: string;
  startedAt: string;
  durationSec: number;
  simulatedByUser: boolean;
}

/** Tipos de pausa de Control Next (en el orden del selector). */
export type PauseReason =
  | 'Almuerzo Teletrabajo'
  | 'BREAK AM'
  | 'ALMUERZO'
  | 'BREAK PM'
  | 'BAÑO'
  | 'CAPACITACIÓN'
  | 'RETROALIMENTACION'
  | 'PAUSA ACTIVAS';

export interface PauseRecord {
  id: string;
  reason: PauseReason;
  startedAt: string;
  endedAt?: string;
}

export type ConnectionState = 'conectado' | 'en-pausa' | 'desconectado';

export interface Session {
  document: string;
  advisorUsername: string;
  startedAt: number;
  expiresAt: number;
}

export interface ActiveCall {
  customerId: string;
  startedAt: string;
}

/** Datos semilla generados al montar el simulador (no se persisten). */
export interface Dataset {
  generatedAt: Date;
  customers: Customer[];
  managements: Management[];
  payments: Payment[];
  calls: CallRecord[];
}

/** Cliente con los campos derivados de sus gestiones. */
export interface CustomerView extends Customer {
  managements: Management[];
  lastManagement: Management | null;
  lastProfile: ProfileCode;
  bestProfile: ProfileCode;
  status: ManagementStatus;
  totalPromises: number;
  promiseDates: string[];
  totalBalance: number;
  maxDaysPastDue: number;
  obligationStatuses: ObligationStatus[];
}

export type SortField = 'nombre' | 'mora' | 'saldo' | 'fecha-gestion' | 'promesas';
export type SortDir = 'asc' | 'desc';

export interface CustomerFilters {
  promiseFrom: string;
  promiseTo: string;
  managedFrom: string;
  managedTo: string;
  sortField: SortField;
  sortDir: SortDir;
  city: string;
  advisor: string;
  bestProfiles: ProfileCode[];
  lastProfiles: ProfileCode[];
  statuses: ManagementStatus[];
  text: string;
  priority: Priority | '';
  obligationStatus: ObligationStatus | '';
}

export type RangeKey = 'hoy' | 'semana' | 'mes' | 'mes-anterior';
