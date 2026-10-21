// Prueba de tipificación: seis llamadas grabadas (audios de entrenamiento de la operación, con datos ficticios).
// Cada ejercicio trae su cliente ficticio coherente con el audio y las reglas del sistema experto, una por checkmark.
// Los audios hablan como si la llamada fuera el viernes 16/10/2026 (fecha de referencia del ejercicio).

import type { Customer, Management } from '../../types/simulator';
import { EXERCISE_REFERENCE_DATE, EXERCISE_RULES } from '../../../../server/domain/tipifica/exercises.js';
import type { Rule } from '../../../../server/domain/tipifica/engine.js';

export { EXERCISE_REFERENCE_DATE };

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

export const EXERCISES: Exercise[] = [
  {
    id: 'ejercicio-1',
    number: 1,
    title: 'Contacto con el titular',
    audio: '/tipifica/audio/ejercicio-1',
    brief: 'Llamas al titular para informarle su saldo. Escucha qué responde.',
    customer: customer(1, 'Andrés Castro Vargas', '1000318842', '310 555 0142', 'Bogotá', 285_000, 45),
    rules: EXERCISE_RULES[0]!.rules,
  },
  {
    id: 'ejercicio-2',
    number: 2,
    title: 'Contacto con un tercero',
    audio: '/tipifica/audio/ejercicio-2',
    brief: 'Llamas buscando al titular. Escucha quién contesta.',
    customer: customer(2, 'Carlos Ramírez Díaz', '1000427316', '312 555 0216', 'Medellín', 640_000, 72),
    rules: EXERCISE_RULES[1]!.rules,
  },
  {
    id: 'ejercicio-3',
    number: 3,
    title: 'Promesa de pago',
    audio: '/tipifica/audio/ejercicio-3',
    brief: 'Llamas a un titular que ya tenía pensado pagar. Anota la fecha y el valor exactos.',
    customer: customer(3, 'Felipe Torres Mejía', '1000539027', '315 555 0327', 'Cali', 360_000, 38),
    rules: EXERCISE_RULES[2]!.rules,
  },
  {
    id: 'ejercicio-4',
    number: 4,
    title: 'Solicitud de devolución de llamada',
    audio: '/tipifica/audio/ejercicio-4',
    brief: 'La titular no puede atender ahora. Escucha cuándo pide que la llames.',
    customer: customer(4, 'Diana Restrepo Suárez', '1000641508', '318 555 0408', 'Barranquilla', 520_000, 21),
    rules: EXERCISE_RULES[3]!.rules,
  },
  {
    id: 'ejercicio-5',
    number: 5,
    title: 'Pago ya realizado',
    audio: '/tipifica/audio/ejercicio-5',
    brief: 'El titular asegura que ya pagó. Escucha qué datos da del pago.',
    customer: customer(5, 'Óscar Martínez Pérez', '1000752893', '311 555 0593', 'Bucaramanga', 250_000, 30),
    rules: EXERCISE_RULES[4]!.rules,
  },
  {
    id: 'ejercicio-6',
    number: 6,
    title: 'Número equivocado o no contacto',
    audio: '/tipifica/audio/ejercicio-6',
    brief: 'Llamas buscando al titular. Escucha si el número es suyo.',
    customer: customer(6, 'Javier Morales Rojas', '1000863154', '316 555 0654', 'Pereira', 410_000, 95),
    rules: EXERCISE_RULES[5]!.rules,
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
