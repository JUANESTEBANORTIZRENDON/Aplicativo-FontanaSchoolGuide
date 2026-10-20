// Pagos y llamadas ficticios derivados de las gestiones semilla. Las métricas del panel no se
// escriben a mano: se calculan en domain/metrics.ts a partir de estos registros.

import type { CallRecord, Customer, Dataset, Management, Payment } from '../types/simulator';
import { addDays, fromDateKey, startOfDay, toDateKey } from '../utils/dates';
import { generateCustomers } from './mock-customers';
import { createRng } from './random';

function generatePayments(customers: Customer[], managements: Management[], now: Date): Payment[] {
  const rng = createRng(4242);
  const todayKey = toDateKey(now);
  const payments: Payment[] = [];

  // Promesas vencidas: la mayoría se cumplen en su fecha.
  for (const m of managements) {
    if (m.result !== 'promesa-pago' || !m.promiseDate || !m.promiseAmount) continue;
    if (m.promiseDate >= todayKey || !rng.chance(0.65)) continue;
    const date = fromDateKey(m.promiseDate);
    date.setHours(rng.int(9, 18), rng.int(0, 59));
    payments.push({ id: `pay-${m.id}`, customerId: m.customerId, date: date.toISOString(), amount: m.promiseAmount });
  }

  // Abonos espontáneos en los últimos 60 días.
  for (const c of customers) {
    if (!rng.chance(0.25)) continue;
    const date = addDays(startOfDay(now), -rng.int(1, 60));
    date.setHours(rng.int(9, 18), rng.int(0, 59));
    payments.push({ id: `pay-extra-${c.id}`, customerId: c.id, date: date.toISOString(), amount: rng.int(5, 40) * 10_000 });
  }
  return payments;
}

function generateCalls(managements: Management[]): CallRecord[] {
  const rng = createRng(777);
  return managements.map((m) => {
    const short = m.result === 'no-contesta' || m.result === 'numero-invalido';
    const durationSec = short ? rng.int(15, 45) : rng.int(60, 480);
    return {
      id: `call-${m.id}`,
      customerId: m.customerId,
      startedAt: new Date(new Date(m.date).getTime() - durationSec * 1000).toISOString(),
      durationSec,
      simulatedByUser: false,
    };
  });
}

/** Genera todos los datos semilla a partir de la fecha actual. */
export function createDataset(now: Date): Dataset {
  const { customers, managements } = generateCustomers(now);
  return {
    generatedAt: now,
    customers,
    managements,
    payments: generatePayments(customers, managements, now),
    calls: generateCalls(managements),
  };
}
