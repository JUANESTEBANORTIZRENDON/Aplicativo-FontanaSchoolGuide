// Sistema experto de tipificación. Cada ejercicio declara reglas (una por checkmark); el motor las evalúa contra lo
// que el asesor tipificó y escribió, y devuelve qué cumplió, qué no y por qué. Agregar una regla nueva no exige
// tocar el motor: basta con crearla con las fábricas de abajo (principio abierto/cerrado).

import { contactLabel, findProfile, type ActionCode, type ChannelCode, type ContactCode } from '../typification/catalog';
import type { TypificationDraft } from '../typification/draft';
import { parseAmount } from '../management-form';
import { extractFacts, mentions, type NoteFacts } from './facts';

export interface RuleContext {
  draft: TypificationDraft;
  facts: NoteFacts;
  now: Date;
}

export interface RuleResult {
  ok: boolean;
  /** Explicación para el asesor (por qué sí o por qué no). */
  detail: string;
}

export interface Rule {
  id: string;
  /** Respuesta esperada («Contacto: Contacto Directo»). Se muestra solo en la explicación tras evaluar. */
  label: string;
  /** Lo que se revisa, sin dar la respuesta («Contacto correcto: ¿quién contestó?»). Es el texto del checkmark. */
  goal?: string;
  check(ctx: RuleContext): RuleResult;
}

export interface Evaluation {
  items: (RuleResult & { id: string; label: string })[];
  passed: number;
  total: number;
  /** 0–100 */
  score: number;
  approved: boolean;
}

export function evaluate(rules: Rule[], draft: TypificationDraft, now = new Date()): Evaluation {
  const ctx: RuleContext = { draft, facts: extractFacts(draft.note), now };
  const items = rules.map((r) => ({ id: r.id, label: r.label, ...r.check(ctx) }));
  const passed = items.filter((i) => i.ok).length;
  return { items, passed, total: items.length, score: items.length ? Math.round((passed / items.length) * 100) : 0, approved: passed === items.length };
}

const ok = (detail: string): RuleResult => ({ ok: true, detail });
const fail = (detail: string): RuleResult => ({ ok: false, detail });

// ---------- Reglas de campos ----------

export function actionIs(expected: ActionCode, why: string): Rule {
  const label = expected === 'recibir-llamada' ? 'Acción: Recibir Llamada' : 'Acción: Hacer Llamada';
  return {
    id: 'accion',
    label,
    goal: 'Acción correcta: ¿quién hizo la llamada?',
    check: ({ draft }) =>
      draft.action === expected ? ok(why) : fail(`${why} Por eso la acción es «${expected === 'recibir-llamada' ? 'Recibir Llamada' : 'Hacer Llamada'}».`),
  };
}

export function contactIs(expected: ContactCode, why: string): Rule {
  return {
    id: 'contacto',
    label: `Contacto: ${contactLabel(expected)}`,
    goal: 'Contacto correcto: ¿quién contestó?',
    check: ({ draft }) => (draft.contact === expected ? ok(why) : fail(`${why} Corresponde «${contactLabel(expected)}».`)),
  };
}

export function channelIs(expected: ChannelCode): Rule {
  return {
    id: 'canal',
    label: 'Canal: Telefonico',
    goal: 'Canal correcto',
    check: ({ draft }) => (draft.channel === expected ? ok('La gestión fue por llamada.') : fail('La gestión fue una llamada: el canal es «Telefonico».')),
  };
}

export function profileIn(accepted: string[], why: string): Rule {
  return {
    id: 'perfil',
    label: `Perfil: ${accepted.join(' o ')}`,
    goal: 'Perfil acorde a cómo terminó la llamada',
    check: ({ draft }) => {
      if (!findProfile(draft.contact, draft.profile)) return fail('Elige un perfil válido para el contacto que marcaste.');
      return accepted.includes(draft.profile) ? ok(why) : fail(`Elegiste «${draft.profile}». ${why}`);
    },
  };
}

export function reasonIn(accepted: string[], why: string): Rule {
  return {
    id: 'motivo',
    label: `Motivo No Pago: ${accepted.join(' o ')}`,
    goal: 'Motivo No Pago acorde a lo que se dijo',
    check: ({ draft }) => (accepted.includes(draft.reason) ? ok(why) : fail(`${draft.reason ? `Elegiste «${draft.reason}». ` : ''}${why}`)),
  };
}

export function phoneIs(expected: string): Rule {
  const digits = expected.replace(/\D/g, '');
  return {
    id: 'telefono',
    label: 'Teléfono de la llamada',
    check: ({ draft }) =>
      draft.phone.replace(/\D/g, '') === digits ? ok(`Registraste el número ${digits}.`) : fail(`El teléfono de esta llamada es ${digits}.`),
  };
}

// ---------- Reglas de la nota ----------

export function noteStartsWithPhone(): Rule {
  return {
    id: 'nota-telefono',
    label: 'La gestión empieza con «teléfono //»',
    check: ({ facts }) =>
      facts.startsWithPhone ? ok('Empieza con el número y //.') : fail('Empieza la gestión con el número marcado seguido de «//», p. ej. «3001234567 // TT INDICA QUE…».'),
  };
}

export function noteMentions(id: string, label: string, terms: string[], hint: string): Rule {
  return { id, label, check: ({ facts }) => (mentions(facts, terms) ? ok('Lo dejaste escrito.') : fail(hint)) };
}

export function noteAmount(expected: number, label = 'El valor acordado queda escrito en la gestión'): Rule {
  return {
    id: 'nota-valor',
    label,
    check: ({ facts }) =>
      facts.amounts.some((a) => Math.abs(a - expected) <= expected * 0.01)
        ? ok(`Escribiste el valor de ${expected.toLocaleString('es-CO')}.`)
        : fail(`Escribe en la gestión el valor exacto: $ ${expected.toLocaleString('es-CO')}.`),
  };
}

/** La nota menciona la fecha (día del mes, día de la semana o «mañana»). */
export function noteDate(label: string, accept: { day?: number; weekday?: number; relative?: 'manana' | 'hoy' }[], hint: string): Rule {
  return {
    id: 'nota-fecha',
    label,
    check: ({ facts }) =>
      facts.dates.some((d) => accept.some((a) => (a.day !== undefined && d.day === a.day) || (a.weekday !== undefined && d.weekday === a.weekday) || (a.relative && d.relative === a.relative)))
        ? ok('La fecha quedó escrita.')
        : fail(hint),
  };
}

export function noteTime(label: string, minutes: number, hint: string): Rule {
  return {
    id: 'nota-hora',
    label,
    check: ({ facts }) => (facts.times.some((t) => Math.abs(t - minutes) <= 30) ? ok('La hora quedó escrita.') : fail(hint)),
  };
}

export function noteMinWords(min: number): Rule {
  return {
    id: 'nota-detalle',
    label: `Gestión con detalle suficiente (mín. ${min} palabras)`,
    check: ({ facts }) =>
      facts.words >= min ? ok(`${facts.words} palabras.`) : fail(`Escribiste ${facts.words} palabras: cuenta qué dijo la persona, qué se le informó y cómo quedó.`),
  };
}

/** Con un tercero no se registran valores de la deuda ni acuerdos (protección de datos del titular). */
export function noDebtWithThirdParty(): Rule {
  return {
    id: 'tercero-sin-deuda',
    label: 'Sin negociar ni dar valores al tercero',
    goal: 'Protección de los datos del titular',
    check: ({ draft, facts }) => {
      const profile = findProfile(draft.contact, draft.profile);
      if (profile?.needs === 'acuerdo') return fail('Con un tercero no se registra un acuerdo de pago: solo el titular puede comprometerse.');
      if (facts.amounts.length) return fail('No escribas valores de la deuda en una gestión con tercero: a un tercero no se le informa la obligación.');
      return ok('No se negoció ni se dieron valores al tercero.');
    },
  };
}

/** Los datos del acuerdo del formulario (fecha y valor) coinciden con lo pactado. */
export function agreementFields(amount: number, dayOfMonth?: number): Rule {
  return {
    id: 'acuerdo-campos',
    label: 'Fecha y valor del acuerdo registrados',
    goal: 'Fecha y valor del acuerdo en el formulario',
    check: ({ draft }) => {
      const value = parseAmount(draft.promiseAmount);
      if (!draft.promiseDate || !Number.isFinite(value)) return fail('Completa la fecha de pago y el valor del acuerdo en el formulario.');
      if (Math.abs(value - amount) > amount * 0.01) return fail(`El valor del acuerdo es $ ${amount.toLocaleString('es-CO')}.`);
      if (dayOfMonth !== undefined && Number(draft.promiseDate.slice(8, 10)) !== dayOfMonth) return fail(`La fecha de pago acordada es el día ${dayOfMonth}.`);
      return ok('Fecha y valor coinciden con lo pactado.');
    },
  };
}

export function callbackScheduled(): Rule {
  return {
    id: 'agenda',
    label: 'Nueva llamada agendada',
    goal: 'Nueva llamada agendada',
    check: ({ draft, now }) =>
      draft.callbackAt && new Date(draft.callbackAt) > now ? ok('Quedó agendada la nueva llamada.') : fail('Agenda la fecha y hora para volver a llamar.'),
  };
}
