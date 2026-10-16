import { describe, expect, it } from 'vitest';
import { computeModuleViews, type Availability, type ModuleInput } from '../domain/progress.js';

const now = new Date('2026-10-16T12:00:00Z');
const activity = (id: string, order: number) => ({ id, title: id, type: 'QUIZ', order, status: 'ACTIVE' as const, isRequired: true, route: null });
const module: ModuleInput = { id: 'm1', slug: 'm1', name: 'M1', order: 1, status: 'ACTIVE', route: '/m1', prerequisites: [], activities: [activity('a', 1), activity('b', 2), activity('c', 3)] };
const availability = (patch: Partial<Availability>): Availability => ({
  passed: false, openAttemptId: null, remaining: 3, exhausted: false, waitUntil: null, canStart: true, grantOverrideId: null, resetWaitOverrideId: null, nextNumber: 1, ...patch,
});
const view = (availabilities: Record<string, Partial<Availability>>) => computeModuleViews([module], {
  moduleProgress: new Map(), activityProgress: new Map(), sealedModuleIds: new Set(), overrides: [],
  availability: new Map(Object.entries(availabilities).map(([id, patch]) => [id, availability(patch)])),
}, now)[0]!;

describe('módulo con una actividad sin intentos', () => {
  it('sigue abierto mientras queden otras actividades pendientes', () => {
    expect(view({ a: { passed: true }, b: { exhausted: true, remaining: 0, canStart: false }, c: {} })).toMatchObject({ status: 'IN_PROGRESS', enabled: true });
  });

  it('se detiene cuando todo lo pendiente está agotado', () => {
    expect(view({ a: { passed: true }, b: { exhausted: true, remaining: 0 }, c: { exhausted: true, remaining: 0 } })).toMatchObject({ status: 'FAILED', enabled: false });
  });

  it('con una sola actividad pendiente y agotada, se detiene', () => {
    expect(view({ a: { passed: true }, b: { passed: true }, c: { exhausted: true, remaining: 0 } })).toMatchObject({ status: 'FAILED', enabled: false });
  });
});
