import { describe, expect, it } from 'vitest';
import { evaluate } from '../domain/expert/engine';
import { EXERCISE_REFERENCE_DATE as NOW, EXERCISES } from '../domain/expert/exercises';
import { extractFacts } from '../domain/expert/facts';
import { contactOptions, profileOptions } from '../domain/typification/catalog';
import { EMPTY_DRAFT, validateDraft, type TypificationDraft } from '../domain/typification/draft';

const ex = (n: number) => EXERCISES[n - 1]!;
const draft = (patch: Partial<TypificationDraft>): TypificationDraft => ({ ...EMPTY_DRAFT, action: 'hacer-llamada', channel: 'telefonico', ...patch });
const failed = (n: number, d: TypificationDraft) => evaluate(ex(n).rules, d, NOW).items.filter((i) => !i.ok).map((i) => i.id);

/** Una tipificación bien hecha de cada audio. */
const GOOD: Record<number, TypificationDraft> = {
  1: draft({ contact: 'directo', profile: 'No hubo acuerdo', reason: 'No cuenta con el dinero', phone: '3105550142',
    note: '3105550142 // TT VALIDA IDENTIDAD, SE INFORMA SALDO DE 285.000. INDICA QUE HA TENIDO GASTOS Y NO PUEDE COMPROMETERSE CON UNA FECHA, SE COMUNICARA POR LOS CANALES OFICIALES.' }),
  2: draft({ contact: 'indirecto', profile: 'Mensaje con tercero', reason: 'Ocupado', phone: '3125550216',
    note: '3125550216 // CONTESTA LA HERMANA, INDICA QUE EL TITULAR ESTA TRABAJANDO Y CASI NO CONTESTA EN EL DIA. NO SE DA INFORMACION DE LA OBLIGACION.' }),
  3: draft({ contact: 'directo', profile: 'Acuerdo de pago Abono', reason: 'Confirmar pago', phone: '3155550327', promiseDate: '2026-10-21', promiseAmount: '180000',
    note: '3155550327 // TT INDICA QUE REALIZARA UN ABONO DE 180.000 EL MIERCOLES 21 DE OCTUBRE POR CANALES OFICIALES.' }),
  4: draft({ contact: 'directo', profile: 'Volver a llamar', reason: 'Ocupado', phone: '3185550408', callbackAt: '2026-10-19T10:00',
    note: '3185550408 // TT INDICA QUE ESTA EN REUNION, SOLICITA VOLVER A LLAMAR EL LUNES A LAS 10 AM.' }),
  5: draft({ contact: 'directo', profile: 'PQR', reason: 'Con recibo', phone: '3115550593',
    note: '3115550593 // TT INDICA QUE PAGO 250 MIL EL 15 DE OCTUBRE POR TRANSFERENCIA, TIENE COMPROBANTE Y LO ENVIARA. QUEDA PENDIENTE DE VALIDACION.' }),
  6: draft({ contact: 'sin-contacto', profile: 'Número equivocado', reason: 'Número equivocado', phone: '3165550654',
    note: '3165550654 // CONTESTA UNA PERSONA QUE NO CONOCE AL TITULAR, NUMERO EQUIVOCADO. SE REPORTA PARA ACTUALIZAR.' }),
};

describe('sistema experto de tipificación', () => {
  it('una tipificación correcta cumple todos los checkmarks de cada audio', () => {
    for (const n of [1, 2, 3, 4, 5, 6]) {
      const result = evaluate(ex(n).rules, GOOD[n]!, NOW);
      expect({ n, fallas: result.items.filter((i) => !i.ok).map((i) => `${i.id}: ${i.detail}`) }).toEqual({ n, fallas: [] });
      expect(result.approved).toBe(true);
      // y además pasa la validación del formulario (con la fecha de referencia del audio)
      expect(validateDraft(GOOD[n]!, ex(n).customer.obligations[0]!.balance, NOW)).toEqual({});
    }
  });

  it('confundir directo con indirecto se detecta', () => {
    expect(failed(2, { ...GOOD[2]!, contact: 'directo', profile: 'No hubo acuerdo' })).toEqual(expect.arrayContaining(['contacto', 'perfil']));
    expect(failed(1, { ...GOOD[1]!, contact: 'indirecto', profile: 'Mensaje con tercero' })).toEqual(expect.arrayContaining(['contacto', 'perfil']));
  });

  it('con un tercero no se escriben valores ni se registra acuerdo', () => {
    expect(failed(2, { ...GOOD[2]!, note: `${GOOD[2]!.note} SE LE INFORMA SALDO DE 640.000` })).toContain('tercero-sin-deuda');
  });

  it('el abono exige fecha y valor exactos, en el formulario y en la nota', () => {
    expect(failed(3, { ...GOOD[3]!, promiseAmount: '360000' })).toContain('acuerdo-campos');
    expect(failed(3, { ...GOOD[3]!, profile: 'Acuerdo de pago Total' })).toContain('perfil');
    expect(failed(3, { ...GOOD[3]!, note: '3155550327 // TT HACE UN ABONO EL MIERCOLES' })).toContain('nota-valor');
  });

  it('pago sin validar no es Paz y Salvo; número equivocado es Sin Contacto', () => {
    expect(failed(5, { ...GOOD[5]!, profile: 'Paz y Salvo' })).toContain('perfil');
    expect(failed(6, { ...GOOD[6]!, contact: 'indirecto', profile: 'Titular no reside / no labora ahí' })).toContain('contacto');
  });

  it('la nota debe empezar con el teléfono y decir quién contestó', () => {
    expect(failed(1, { ...GOOD[1]!, note: 'SE INFORMA SALDO, HA TENIDO GASTOS Y SE COMUNICARA POR CANALES OFICIALES MAS ADELANTE CON FECHA' })).toEqual(
      expect.arrayContaining(['nota-telefono', 'nota-quien']),
    );
  });
});

describe('lógica dependiente del formulario', () => {
  it('Recibir Llamada no ofrece Sin Contacto; Hacer Llamada sí', () => {
    expect(contactOptions('recibir-llamada').map((c) => c.code)).toEqual(['directo', 'indirecto']);
    expect(contactOptions('hacer-llamada').map((c) => c.code)).toEqual(['directo', 'indirecto', 'sin-contacto']);
    expect(validateDraft({ ...GOOD[6]!, action: 'recibir-llamada' }, 1, NOW).contact).toBeDefined();
  });

  it('el perfil depende del contacto y los acuerdos piden fecha y valor', () => {
    expect(profileOptions('directo').map((p) => p.label)).toContain('Acuerdo de pago Abono');
    expect(profileOptions('indirecto').map((p) => p.label)).not.toContain('Acuerdo de pago Abono');
    const e = validateDraft({ ...GOOD[3]!, promiseDate: '', promiseAmount: '' }, 360_000, NOW);
    expect(Object.keys(e).sort()).toEqual(['promiseAmount', 'promiseDate']);
    expect(validateDraft({ ...GOOD[2]!, profile: 'Acuerdo de pago Abono' }, 1, NOW).profile).toBeDefined();
  });
});

describe('hechos de la nota', () => {
  it('lee valores sin confundir teléfonos', () => {
    expect(extractFacts('3125550216 // abono de 180.000').amounts).toEqual([180000]);
    expect(extractFacts('pagó 250 mil').amounts).toEqual([250000]);
    expect(extractFacts('doscientos cincuenta mil').amounts).toEqual([250000]);
    expect(extractFacts('3001234567 // tt indica').amounts).toEqual([]);
  });

  it('lee fechas, días y horas', () => {
    const f = extractFacts('volver a llamar el lunes 19 de octubre a las 10 de la mañana');
    expect(f.dates).toEqual(expect.arrayContaining([{ weekday: 1 }, { day: 19, month: 10 }]));
    expect(f.times).toContain(600);
    expect(extractFacts('paga el 21').dates).toContainEqual({ day: 21 });
    expect(extractFacts('3001234567 // x').startsWithPhone).toBe(true);
  });
});
