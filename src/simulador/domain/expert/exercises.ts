// Prueba de tipificación: seis llamadas grabadas (audios de entrenamiento de la operación, con datos ficticios).
// Cada ejercicio trae su cliente ficticio coherente con el audio y las reglas del sistema experto, una por checkmark.
// Los audios hablan como si la llamada fuera el viernes 16/10/2026 (fecha de referencia del ejercicio).

import type { Customer, Management } from '../../types/simulator';
import {
  actionIs,
  agreementFields,
  callbackScheduled,
  channelIs,
  contactIs,
  noDebtWithThirdParty,
  noteAmount,
  noteDate,
  noteMentions,
  noteMinWords,
  noteStartsWithPhone,
  noteTime,
  phoneIs,
  profileIn,
  reasonIn,
  type Rule,
} from './engine';

/** Fecha y hora en que «ocurre» cada llamada de la prueba. */
export const EXERCISE_REFERENCE_DATE = new Date(2026, 9, 16, 10, 0, 0);

export const EXERCISE_PORTFOLIO = 'aurora';

export interface Exercise {
  id: string;
  number: number;
  title: string;
  /** Ruta del audio sin extensión: se sirve en .mp3 y en .ogg (Opus). */
  audio: string;
  /** Qué escuchará el asesor, sin dar la respuesta. */
  brief: string;
  customer: Customer;
  rules: Rule[];
}

const HOLDER_TERMS = ['tt', 'titular', 'el cliente', 'la clienta', 'sr', 'sra', 'senor', 'senora'];

const customer = (n: number, name: string, document: string, phone: string, city: string, balance: number, days: number): Customer => ({
  id: `ejercicio-${n}`,
  portfolioId: EXERCISE_PORTFOLIO,
  document,
  name,
  phone,
  email: `practica${n}@ejemplo.test`,
  city,
  advisor: 'asesor.practica',
  priority: days > 60 ? 'media' : 'baja',
  obligations: [{ id: `obl-ej-${n}`, product: 'Crédito de consumo', balance, daysPastDue: days, status: 'pendiente' }],
});

/** Reglas comunes a toda llamada saliente por teléfono. */
const outboundCall = (phone: string): Rule[] => [
  actionIs('hacer-llamada', 'La asesora es quien marca al cliente («Lo estoy llamando…»).'),
  channelIs('telefonico'),
  phoneIs(phone),
  noteStartsWithPhone(),
];

export const EXERCISES: Exercise[] = [
  {
    id: 'ejercicio-1',
    number: 1,
    title: 'Contacto con el titular',
    audio: '/tipifica/audio/ejercicio-1',
    brief: 'Llamas al titular para informarle su saldo. Escucha qué responde.',
    customer: customer(1, 'Andrés Castro Vargas', '1000318842', '310 555 0142', 'Bogotá', 285_000, 45),
    rules: [
      ...outboundCall('3105550142'),
      contactIs('directo', 'Contestó el propio titular y validó su identidad (últimos dígitos del documento).'),
      profileIn(['No hubo acuerdo'], 'Reconoce la deuda pero no se compromete con fecha ni valor: «No hubo acuerdo».'),
      reasonIn(['No cuenta con el dinero', 'Disminución de ingresos'], 'Dice que ha tenido gastos y no ha podido ponerse al día.'),
      noteMentions('nota-quien', 'La gestión dice quién contestó', HOLDER_TERMS, 'Escribe quién contestó: «TT» o «titular».'),
      noteMentions('nota-motivo', 'La gestión explica por qué no paga', ['gastos', 'no cuenta', 'no tiene', 'no ha podido', 'no puede', 'dinero', 'revisar', 'cuentas'], 'Escribe el motivo: tuvo gastos y no puede comprometerse con una fecha.'),
      noteMentions('nota-cierre', 'La gestión dice cómo quedó', ['canales', 'se comunica', 'comunicarse', 'comunicara', 'llamara', 'sin fecha', 'no se compromete', 'no da fecha', 'consultar'], 'Escribe cómo quedó: no da fecha y se comunicará por los canales oficiales.'),
      noteMinWords(12),
    ],
  },
  {
    id: 'ejercicio-2',
    number: 2,
    title: 'Contacto con un tercero',
    audio: '/tipifica/audio/ejercicio-2',
    brief: 'Llamas buscando al titular. Escucha quién contesta.',
    customer: customer(2, 'Carlos Ramírez Díaz', '1000427316', '312 555 0216', 'Medellín', 640_000, 72),
    rules: [
      ...outboundCall('3125550216'),
      contactIs('indirecto', 'Contestó la hermana del titular: es un tercero.'),
      profileIn(['Mensaje con tercero'], 'Con un tercero no hay negociación: se registra que se habló con él.'),
      reasonIn(['Ocupado', 'No contestan'], 'La hermana cuenta que el titular trabaja y casi no contesta durante el día.'),
      noDebtWithThirdParty(),
      noteMentions('nota-tercero', 'La gestión dice quién contestó', ['hermana', 'tercero', 'familiar'], 'Escribe quién contestó y su parentesco: «contesta la hermana».'),
      noteMentions('nota-titular', 'La gestión dice qué pasa con el titular', ['trabaja', 'trabajando', 'no esta', 'no se encuentra', 'no contesta', 'ausente'], 'Escribe por qué no estaba el titular: está trabajando y casi no contesta de día.'),
      noteMinWords(10),
    ],
  },
  {
    id: 'ejercicio-3',
    number: 3,
    title: 'Promesa de pago',
    audio: '/tipifica/audio/ejercicio-3',
    brief: 'Llamas a un titular que ya tenía pensado pagar. Anota la fecha y el valor exactos.',
    customer: customer(3, 'Felipe Torres Mejía', '1000539027', '315 555 0327', 'Cali', 360_000, 38),
    rules: [
      ...outboundCall('3155550327'),
      contactIs('directo', 'Habló el titular tras validar su identidad.'),
      profileIn(['Acuerdo de pago Abono'], 'Paga 180 mil de un saldo de 360 mil: es un abono, no el pago total.'),
      reasonIn(['Confirmar pago'], 'Queda un pago pactado que hay que confirmar en la fecha.'),
      agreementFields(180_000, 21),
      noteAmount(180_000),
      noteDate('La fecha del compromiso queda escrita', [{ day: 21 }, { weekday: 3 }], 'Escribe la fecha del compromiso: miércoles 21 de octubre.'),
      noteMentions('nota-abono', 'La gestión dice si es pago total o abono', ['abono', 'abonar', 'abonara'], 'Aclara que el compromiso es un abono (no el total).'),
    ],
  },
  {
    id: 'ejercicio-4',
    number: 4,
    title: 'Solicitud de devolución de llamada',
    audio: '/tipifica/audio/ejercicio-4',
    brief: 'La titular no puede atender ahora. Escucha cuándo pide que la llames.',
    customer: customer(4, 'Diana Restrepo Suárez', '1000641508', '318 555 0408', 'Barranquilla', 520_000, 21),
    rules: [
      ...outboundCall('3185550408'),
      contactIs('directo', 'Contestó la titular («Sí, con ella»).'),
      profileIn(['Volver a llamar'], 'Pide expresamente que la llamen después: «Volver a llamar».'),
      reasonIn(['Ocupado'], 'Está en una reunión.'),
      callbackScheduled(),
      {
        id: 'agenda-lunes',
        label: 'Agendada el lunes a las 10:00 a. m.',
        goal: 'Agendada el día y la hora que pidió la titular',
        check: ({ draft }) => {
          const when = draft.callbackAt ? new Date(draft.callbackAt) : null;
          return when && when.getDay() === 1 && when.getHours() === 10
            ? { ok: true, detail: 'Lunes a las 10:00, como pidió la titular.' }
            : { ok: false, detail: 'Pidió la llamada el lunes a las 10 de la mañana: agéndala así.' };
        },
      },
      noteDate('El día pactado queda escrito', [{ weekday: 1 }, { day: 19 }], 'Escribe el día pactado: lunes 19 de octubre.'),
      noteTime('La hora pactada queda escrita', 10 * 60, 'Escribe la hora pactada: 10 a. m.'),
      noteMentions('nota-motivo', 'La gestión explica qué pidió la persona', ['reunion', 'ocupada', 'ocupado', 'no puede atender'], 'Escribe por qué no pudo atender: estaba en una reunión.'),
    ],
  },
  {
    id: 'ejercicio-5',
    number: 5,
    title: 'Pago ya realizado',
    audio: '/tipifica/audio/ejercicio-5',
    brief: 'El titular asegura que ya pagó. Escucha qué datos da del pago.',
    customer: customer(5, 'Óscar Martínez Pérez', '1000752893', '311 555 0593', 'Bucaramanga', 250_000, 30),
    rules: [
      ...outboundCall('3115550593'),
      contactIs('directo', 'Contestó el titular («Sí, señora, con él»).'),
      profileIn(['PQR'], 'El pago todavía no aparece aplicado: queda como solicitud de verificación (PQR). No se marca «Paz y Salvo» hasta confirmar el pago.'),
      reasonIn(['Con recibo'], 'El titular tiene el comprobante del pago.'),
      noteAmount(250_000, 'El valor que dice haber pagado queda escrito'),
      noteDate('La fecha en que dice haber pagado queda escrita', [{ day: 15 }], 'Escribe la fecha en que dice que pagó: 15 de octubre.'),
      noteMentions('nota-medio', 'Medio de pago y soporte del pago', ['transferencia', 'comprobante', 'recibo', 'soporte'], 'Escribe que pagó por transferencia y que tiene el comprobante.'),
      noteMentions('nota-pendiente', 'La gestión dice cómo queda el caso', ['pendiente', 'validar', 'validacion', 'verificar', 'verificacion', 'enviara', 'enviar'], 'Escribe que enviará el comprobante y que el pago queda pendiente de validación.'),
    ],
  },
  {
    id: 'ejercicio-6',
    number: 6,
    title: 'Número equivocado o no contacto',
    audio: '/tipifica/audio/ejercicio-6',
    brief: 'Llamas buscando al titular. Escucha si el número es suyo.',
    customer: customer(6, 'Javier Morales Rojas', '1000863154', '316 555 0654', 'Pereira', 410_000, 95),
    rules: [
      ...outboundCall('3165550654'),
      contactIs('sin-contacto', 'Quien contesta no conoce al titular: no hubo contacto con él ni con alguien de su entorno.'),
      profileIn(['Número equivocado'], 'El número no corresponde al titular.'),
      reasonIn(['Número equivocado'], 'El motivo es que el número no es del titular.'),
      noDebtWithThirdParty(),
      noteMentions('nota-no-conoce', 'La gestión explica qué pasó con el número', ['no conoce', 'no vive', 'equivocado', 'no corresponde', 'incorrecto', 'no es del titular'], 'Escribe que quien contesta no conoce al titular y que el número no le corresponde.'),
      noteMentions('nota-accion', 'La gestión dice cuál es el siguiente paso', ['actualizar', 'depurar', 'reportar', 'reporta', 'revisar', 'eliminar', 'incorrecto'], 'Escribe que se reporta el número como incorrecto para que se actualice.'),
    ],
  },
];

export const EXERCISE_CUSTOMERS: Customer[] = EXERCISES.map((e) => e.customer);

/** Una gestión anterior por cliente de la prueba, para que el histórico no aparezca vacío. */
export const EXERCISE_MANAGEMENTS: Management[] = EXERCISES.map((e) => ({
  id: `seed-${e.customer.id}-0`,
  customerId: e.customer.id,
  date: new Date(2026, 9, 6, 15, 12).toISOString(),
  advisor: 'asesor.demo02',
  result: 'no-contesta',
  note: 'Se marca sin respuesta; se intentará en otra franja horaria.',
  action: 'hacer-llamada',
  contact: 'sin-contacto',
  profile: 'No contesta',
  reason: 'No contestan',
}));

export function findExercise(customerId: string): Exercise | undefined {
  return EXERCISES.find((e) => e.customer.id === customerId);
}
