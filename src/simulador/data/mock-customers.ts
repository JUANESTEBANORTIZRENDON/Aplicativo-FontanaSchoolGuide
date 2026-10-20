// Clientes y gestiones ficticios. Las fechas se calculan respecto a `now` para que siempre haya
// clientes en los cuatro estados del semáforo y promesas que vencen hoy, sin importar el día.

import type { Customer, Management, Obligation, Priority, ResultCode } from '../types/simulator';
import { addDays, startOfDay, toDateKey } from '../utils/dates';
import { ADVISORS, CITIES, PRACTICE_ADVISOR } from './catalogs';
import { PORTFOLIOS } from './mock-portfolios';
import { createRng, type Rng } from './random';

const FIRST_NAMES = [
  'Ana', 'Luis', 'Marta', 'Jorge', 'Paula', 'Diego', 'Sandra', 'Andrés', 'Claudia', 'Felipe',
  'Natalia', 'Óscar', 'Liliana', 'Hernán', 'Diana', 'Camilo', 'Gloria', 'Ricardo', 'Yolanda', 'Julián',
  'Patricia', 'Mauricio', 'Adriana', 'Germán',
];

const LAST_NAMES = [
  'Gómez', 'Rodríguez', 'Martínez', 'García', 'Hernández', 'Pérez', 'Sánchez', 'Ramírez', 'Torres',
  'Castro', 'Vargas', 'Rojas', 'Moreno', 'Muñoz', 'Díaz', 'Suárez', 'Mejía', 'Cárdenas', 'Quintero',
];

const PORTFOLIO_SIZES: Record<string, number> = { aurora: 12, 'aurora-propia': 11, andes: 11 };

const MORA_RANGES: Record<string, [number, number]> = {
  aurora: [5, 60],
  'aurora-propia': [20, 130],
  andes: [60, 360],
};

const NOTES: Record<ResultCode, string[]> = {
  'promesa-pago': [
    'Titular acepta acuerdo y se compromete a pagar en la fecha indicada.',
    'Cliente confirma pago parcial por transferencia; se registra compromiso.',
    'Se negocia valor y fecha; el titular confirma que tendrá los recursos.',
  ],
  contactado: [
    'Titular atiende, reconoce la deuda y pide revisar su presupuesto.',
    'Se informa saldo y opciones de pago; el cliente lo pensará.',
    'Cliente indica dificultades económicas temporales; se da información.',
  ],
  'devolucion-llamada': [
    'Titular ocupado en el trabajo; pide que lo llamen más tarde.',
    'Atiende un familiar y solicita volver a llamar en la tarde.',
  ],
  'no-contesta': [
    'Se marca tres veces sin respuesta; buzón de voz.',
    'Timbra sin contestar; se intentará en otra franja horaria.',
  ],
  'numero-invalido': [
    'El número marcado no existe; se solicita actualización de datos.',
    'Contesta un tercero que no conoce al titular.',
  ],
};

const PRACTICE_USER = PRACTICE_ADVISOR.username;

function pickResult(rng: Rng): ResultCode {
  const roll = rng.next();
  if (roll < 0.22) return 'promesa-pago';
  if (roll < 0.45) return 'contactado';
  if (roll < 0.6) return 'devolucion-llamada';
  if (roll < 0.88) return 'no-contesta';
  return 'numero-invalido';
}

function priorityFor(maxDays: number, balance: number): Priority {
  if (maxDays > 90 || balance > 9_000_000) return 'alta';
  if (maxDays > 30) return 'media';
  return 'baja';
}

function atHour(day: Date, rng: Rng): Date {
  const d = new Date(day);
  d.setHours(rng.int(8, 17), rng.int(0, 59), rng.int(0, 59), 0);
  return d;
}

/** Fecha de hoy ya transcurrida (nunca en el futuro ni antes de medianoche). */
function earlierToday(now: Date, rng: Rng): Date {
  const candidate = new Date(now.getTime() - rng.int(15, 240) * 60_000);
  const midnight = startOfDay(now);
  return candidate < midnight ? new Date(midnight.getTime() + 60_000) : candidate;
}

function buildManagement(
  customer: Customer,
  date: Date,
  result: ResultCode,
  index: number,
  rng: Rng,
  now: Date,
  forcedPromiseDate?: string,
): Management {
  const management: Management = {
    id: `seed-${customer.id}-${index}`,
    customerId: customer.id,
    date: date.toISOString(),
    advisor: customer.advisor,
    result,
    note: rng.pick(NOTES[result]),
  };
  if (result === 'promesa-pago') {
    const balance = customer.obligations.reduce((sum, o) => sum + (o.status === 'pagada' ? 0 : o.balance), 0);
    management.promiseDate = forcedPromiseDate ?? toDateKey(addDays(date, rng.int(2, 15)));
    management.promiseAmount = Math.max(50_000, Math.round((balance * rng.int(20, 60)) / 100 / 10_000) * 10_000);
  }
  if (result === 'devolucion-llamada') {
    const callback = addDays(date, rng.int(0, 2));
    callback.setHours(rng.int(14, 18), 0, 0, 0);
    management.callbackAt = (callback < date ? addDays(callback, 1) : callback).toISOString();
  }
  // Las gestiones semilla nunca quedan en el futuro.
  if (new Date(management.date) > now) management.date = now.toISOString();
  return management;
}

export interface SeedCustomers {
  customers: Customer[];
  managements: Management[];
}

export function generateCustomers(now: Date, seed = 20261016): SeedCustomers {
  const rng = createRng(seed);
  const customers: Customer[] = [];
  const managements: Management[] = [];
  const today = startOfDay(now);
  let i = 0;

  for (const portfolio of PORTFOLIOS) {
    const size = PORTFOLIO_SIZES[portfolio.id] ?? 10;
    const [moraMin, moraMax] = MORA_RANGES[portfolio.id] ?? [10, 90];

    for (let j = 0; j < size; j += 1, i += 1) {
      const first = FIRST_NAMES[(i * 7 + 3) % FIRST_NAMES.length] ?? 'Ana';
      const last1 = LAST_NAMES[(i * 5 + 1) % LAST_NAMES.length] ?? 'Gómez';
      const last2 = LAST_NAMES[(i * 11 + 6) % LAST_NAMES.length] ?? 'Rojas';
      const advisor = j % 5 === 4 ? (ADVISORS[1 + (i % 4)]?.username ?? PRACTICE_USER) : PRACTICE_USER;

      const obligationCount = rng.chance(0.55) ? 1 : rng.chance(0.6) ? 2 : 3;
      const obligations: Obligation[] = [];
      for (let k = 0; k < obligationCount; k += 1) {
        const days = rng.int(moraMin, moraMax);
        const base = portfolio.id === 'andes' ? rng.int(3_000, 15_000) : rng.int(300, 8_000);
        const status = rng.chance(0.08)
          ? 'pagada'
          : portfolio.id === 'andes' && days > 200 && rng.chance(0.5)
            ? 'escalada'
            : 'pendiente';
        obligations.push({
          id: `obl-${i + 1}-${k + 1}`,
          product: rng.pick(portfolio.products),
          balance: base * 1_000,
          daysPastDue: days,
          status,
        });
      }

      const maxDays = Math.max(...obligations.map((o) => o.daysPastDue));
      const balance = obligations.reduce((sum, o) => sum + o.balance, 0);
      const customer: Customer = {
        id: `cli-${String(i + 1).padStart(3, '0')}`,
        portfolioId: portfolio.id,
        document: `1000${String(200_000 + ((i * 13_729) % 700_000)).padStart(6, '0')}`,
        name: `${first} ${last1} ${last2}`,
        phone: `3${rng.int(0, 2)}${rng.int(0, 9)} 555 0${String(100 + ((i * 37) % 900)).padStart(3, '0')}`,
        email: `cliente${String(i + 1).padStart(2, '0')}@ejemplo.test`,
        city: rng.pick(CITIES),
        advisor,
        priority: priorityFor(maxDays, balance),
        obligations,
      };
      customers.push(customer);

      // Cubeta del semáforo: 0 sin gestión, 1 hoy, 2 entre 1 y 5 días, 3 más de 5 días.
      const bucket = j % 4;
      if (bucket === 0) continue;

      const lastDate =
        bucket === 1
          ? earlierToday(now, rng)
          : bucket === 2
            ? atHour(addDays(today, -rng.int(1, 5)), rng)
            : atHour(addDays(today, -rng.int(6, 35)), rng);

      // Dos clientes por cartera tienen una promesa que vence hoy.
      const promiseToday = j === 2 || j === 7;
      const lastResult: ResultCode = promiseToday ? 'promesa-pago' : pickResult(rng);

      const history: Management[] = [];
      const previousCount = rng.int(0, 3);
      let cursor = lastDate;
      for (let k = previousCount; k >= 1; k -= 1) {
        cursor = atHour(addDays(startOfDay(cursor), -rng.int(3, 12)), rng);
        history.push(buildManagement(customer, cursor, pickResult(rng), k, rng, now));
      }
      history.push(
        buildManagement(customer, lastDate, lastResult, 0, rng, now, promiseToday ? toDateKey(today) : undefined),
      );
      managements.push(...history);
    }
  }

  return { customers, managements };
}
