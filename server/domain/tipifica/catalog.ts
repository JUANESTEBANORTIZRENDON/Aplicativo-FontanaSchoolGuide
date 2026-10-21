// Catálogo de tipificación de Control Next. Las opciones dependen de la anterior:
//   Acción → Contacto → (Canal) → Perfil → Motivo No Pago.
// Tomado de las capturas del aplicativo. Lo marcado como PROPUESTA no se vio en las capturas y queda pendiente de
// validar con la operación. Para cambiar el catálogo basta con editar estos datos (no hay que tocar la lógica).

/** Resultado de la gestión al que equivale cada perfil (mismos códigos que el clon). */
export type ResultCode = 'promesa-pago' | 'contactado' | 'devolucion-llamada' | 'no-contesta' | 'numero-invalido';

/** Versión del catálogo: se guarda con cada ejercicio oficial calificado. */
export const TIPIFICA_CATALOG_VERSION = 'control-next-v1';

export type ActionCode = 'hacer-llamada' | 'recibir-llamada';
export type ContactCode = 'directo' | 'indirecto' | 'sin-contacto';
export type ChannelCode = 'telefonico' | 'whatsapp' | 'correo';

export interface Option<T extends string> {
  code: T;
  label: string;
}

export const ACTION_OPTIONS: Option<ActionCode>[] = [
  { code: 'hacer-llamada', label: 'Hacer Llamada' },
  { code: 'recibir-llamada', label: 'Recibir Llamada' },
];

const CONTACT_LABELS: Record<ContactCode, string> = {
  directo: 'Contacto Directo',
  indirecto: 'Contacto Indirecto',
  'sin-contacto': 'Sin Contacto',
};

/** Si el cliente llama (Recibir Llamada) siempre hay alguien al otro lado: no existe «Sin Contacto». */
const CONTACTS_BY_ACTION: Record<ActionCode, ContactCode[]> = {
  'hacer-llamada': ['directo', 'indirecto', 'sin-contacto'],
  'recibir-llamada': ['directo', 'indirecto'],
};

export const CHANNEL_OPTIONS: Option<ChannelCode>[] = [
  { code: 'telefonico', label: 'Telefonico' },
  { code: 'whatsapp', label: 'Whatsapp' },
  { code: 'correo', label: 'Correo' },
];

/** Qué datos extra pide cada perfil. */
export type ProfileNeed = 'acuerdo' | 'agenda' | 'ninguno';

export interface ProfileDef {
  label: string;
  result: ResultCode;
  needs: ProfileNeed;
}

const p = (label: string, result: ResultCode, needs: ProfileNeed = 'ninguno'): ProfileDef => ({ label, result, needs });

/** Perfiles con contacto directo (orden de la captura). */
const DIRECT_PROFILES: ProfileDef[] = [
  p('Paz y Salvo', 'contactado'),
  p('Acuerdo de pago Total', 'promesa-pago', 'acuerdo'),
  p('Acuerdo de pago Abono', 'promesa-pago', 'acuerdo'),
  p('Recordar', 'devolucion-llamada', 'agenda'),
  p('Volver a llamar', 'devolucion-llamada', 'agenda'),
  p('Incumplido', 'contactado'),
  p('No hubo acuerdo', 'contactado'),
  p('Renuente', 'contactado'),
  p('No gestionar', 'contactado'),
  p('PQR', 'contactado'),
  p('ABONANDO', 'contactado'),
];

/** PROPUESTA: perfiles con un tercero (no se vieron en las capturas). Con un tercero no se negocia la deuda. */
const INDIRECT_PROFILES: ProfileDef[] = [
  p('Mensaje con tercero', 'contactado'),
  p('Volver a llamar', 'devolucion-llamada', 'agenda'),
  p('Tercero no da información', 'contactado'),
  p('Titular no reside / no labora ahí', 'numero-invalido'),
];

/** PROPUESTA: perfiles sin contacto. */
const NO_CONTACT_PROFILES: ProfileDef[] = [
  p('No contesta', 'no-contesta'),
  p('Buzón de voz', 'no-contesta'),
  p('Apagado / fuera de servicio', 'no-contesta'),
  p('Número equivocado', 'numero-invalido'),
];

const PROFILES_BY_CONTACT: Record<ContactCode, ProfileDef[]> = {
  directo: DIRECT_PROFILES,
  indirecto: INDIRECT_PROFILES,
  'sin-contacto': NO_CONTACT_PROFILES,
};

/** Motivos No Pago con contacto (orden de la captura). */
const PAY_REASONS: string[] = [
  'Confirmar pago',
  'Con recibo',
  'Contesta y cuelga',
  'Desempleado',
  'Disminución de ingresos',
  'Fecha limite de pago',
  'No contestan',
  'No cuenta con el dinero',
  'Ocupado',
  'Olvido pago',
  'Olvido y/o descuido',
  'Posible fraude',
  'Reclamación',
  'Sin voluntad de pago',
  'Tercero Encargado',
];

/** PROPUESTA: sin contacto el motivo describe por qué no se habló con nadie. */
const NO_CONTACT_REASONS: string[] = ['No contestan', 'Ocupado', 'Contesta y cuelga', 'Número equivocado'];

const REASONS_BY_CONTACT: Record<ContactCode, string[]> = {
  directo: PAY_REASONS,
  indirecto: PAY_REASONS,
  'sin-contacto': NO_CONTACT_REASONS,
};

export function contactOptions(action: ActionCode | ''): Option<ContactCode>[] {
  return action ? CONTACTS_BY_ACTION[action].map((code) => ({ code, label: CONTACT_LABELS[code] })) : [];
}

export function contactLabel(code: ContactCode | '' | undefined): string {
  return code ? CONTACT_LABELS[code] : '';
}

export function profileOptions(contact: ContactCode | ''): ProfileDef[] {
  return contact ? PROFILES_BY_CONTACT[contact] : [];
}

export function reasonOptions(contact: ContactCode | ''): string[] {
  return contact ? REASONS_BY_CONTACT[contact] : [];
}

export function findProfile(contact: ContactCode | '', label: string): ProfileDef | undefined {
  return profileOptions(contact).find((x) => x.label === label);
}

export function actionLabel(code: ActionCode | '' | undefined): string {
  return ACTION_OPTIONS.find((a) => a.code === code)?.label ?? '';
}

export function channelLabel(code: ChannelCode | '' | undefined): string {
  return CHANNEL_OPTIONS.find((c) => c.code === code)?.label ?? '';
}
