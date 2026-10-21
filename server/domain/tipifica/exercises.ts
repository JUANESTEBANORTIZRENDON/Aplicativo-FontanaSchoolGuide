// Reglas oficiales de la prueba de tipificación (seis llamadas grabadas). Las comparten el clon de Control Next
// (práctica y vista previa) y el servidor, que es quien califica y guarda el resultado oficial.
// Cambiar una regla o un escenario exige subir su versión: los intentos ya calificados guardan la versión que usaron.

import {
  actionIs, agreementFields, callbackScheduled, channelIs, contactIs, noDebtWithThirdParty, noteAmount, noteDate,
  noteMentions, noteMinWords, noteTime, phoneIs, profileIn, reasonIn, type Rule,
} from './engine.js';

/** Fecha y hora en que «ocurre» cada llamada de la prueba (los audios hablan del viernes 16/10/2026). */
export const EXERCISE_REFERENCE_DATE = new Date(2026, 9, 16, 10, 0, 0);
export const TIPIFICA_SCENARIO_VERSION = 1;
export const TIPIFICA_RULES_VERSION = 1;
export const TIPIFICA_EXERCISE_COUNT = 6;

export interface ExerciseRules {
  key: string;
  number: number;
  title: string;
  /** Saldo de la obligación del cliente ficticio: valida el valor de un acuerdo. */
  balance: number;
  rules: Rule[];
}

const HOLDER_TERMS = ['tt', 'titular', 'el cliente', 'la clienta', 'sr', 'sra', 'senor', 'senora'];

/** Reglas comunes a toda llamada saliente por teléfono. */
const outboundCall = (phone: string): Rule[] => [
  actionIs('hacer-llamada', 'La asesora es quien marca al cliente («Lo estoy llamando…»).'),
  channelIs('telefonico'),
  phoneIs(phone),
];

export const EXERCISE_RULES: readonly ExerciseRules[] = [
  {
    key: 'ejercicio-1',
    number: 1,
    title: 'Contacto con el titular',
    balance: 285000,
    rules: [
    ...outboundCall('3105550142'),
    contactIs('directo', 'Contestó el propio titular y validó su identidad (últimos dígitos del documento).'),
    profileIn(['No hubo acuerdo'], 'Reconoce la deuda pero no se compromete con fecha ni valor: «No hubo acuerdo».'),
    reasonIn(['No cuenta con el dinero', 'Disminución de ingresos'], 'Dice que ha tenido gastos y no ha podido ponerse al día.'),
    noteMentions('nota-quien', 'La gestión dice quién contestó', HOLDER_TERMS, 'Escribe quién contestó: «TT» o «titular».'),
    noteMentions('nota-motivo', 'La gestión explica por qué no paga', ['gastos', 'no cuenta', 'no tiene', 'no ha podido', 'no puede', 'dinero', 'revisar', 'cuentas'], 'Escribe el motivo: tuvo gastos y no puede comprometerse con una fecha.'),
    noteMinWords(12),
    ],
  },
  {
    key: 'ejercicio-2',
    number: 2,
    title: 'Contacto con un tercero',
    balance: 640000,
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
    key: 'ejercicio-3',
    number: 3,
    title: 'Promesa de pago',
    balance: 360000,
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
    key: 'ejercicio-4',
    number: 4,
    title: 'Solicitud de devolución de llamada',
    balance: 520000,
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
    key: 'ejercicio-5',
    number: 5,
    title: 'Pago ya realizado',
    balance: 250000,
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
    key: 'ejercicio-6',
    number: 6,
    title: 'Número equivocado o no contacto',
    balance: 410000,
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

/** Título de la actividad evaluable del ejercicio («Ejercicio 3: Promesa de pago»). */
export function tipificaActivityTitle(exercise: Pick<ExerciseRules, 'number' | 'title'>): string {
  return `Ejercicio ${exercise.number}: ${exercise.title}`;
}

export function exerciseRules(number: number): ExerciseRules | undefined {
  return EXERCISE_RULES.find((e) => e.number === number);
}
