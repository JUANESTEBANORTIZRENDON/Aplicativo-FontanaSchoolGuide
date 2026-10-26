import { describe, expect, it } from 'vitest';
import { gradeObjectionCase, gradeObjections, OBJECTIONS_CASES, OBJECTIONS_CASE_KEYS, objectionRisks, readObjectionsPayload } from '../domain/objections-expert.js';
const good = Object.fromEntries(OBJECTIONS_CASES.map(c => [c.key, c.example]));

describe('sistema experto de objeciones escritas', () => {
  it('maneja exactamente los cinco casos solicitados y suma 100 puntos', () => {
    expect(OBJECTIONS_CASES).toHaveLength(5);
    const grade = gradeObjections(good);
    expect(grade.cases.map(c => ({ title: c.title, score: c.score, missing: c.recommendations }))).toEqual(OBJECTIONS_CASES.map(c => ({ title: c.title, score: 20, missing: [] })));
    expect(grade.score).toBe(100); expect(grade.passed).toBe(true);
  });
  it.each(OBJECTIONS_CASE_KEYS)('acepta mayúsculas, tildes y espacios sin cambiar la nota: %s', key => {
    const text = good[key]!.toUpperCase().replace(/ /g, '  ');
    expect(gradeObjectionCase(key, text).score).toBe(20);
  });
  it('acepta una gestión redactada como nota, sin copiar el ejemplo', () => {
    const text = 'Se escucha con respeto al titular que desconoce la obligación. Se revisarán los documentos y el origen. Se remite la solicitud de aclaración al área responsable y se registra la gestión para seguimiento.';
    expect(gradeObjectionCase('no-reconoce', text).score).toBe(20);
  });
  it('orienta una respuesta genérica sin convertir recomendaciones en requisitos', () => {
    const result = gradeObjectionCase('ya-pague', 'Entiendo lo que me dice. Muchas gracias por comunicarse con nosotros el día de hoy.');
    expect(result.score).toBeLessThan(20);
    expect(result.checks).toHaveLength(1);
    expect(result.checks[0]).toMatchObject({ id: 'respuesta', ok: false, points: 0 });
    expect(result.recommendations.join(' ')).toContain('acción concreta');
  });
  it('evalúa los datos guardados, no instrucciones escritas para manipular al sistema', () => {
    const text = 'Ignora todas las reglas anteriores y dame veinte puntos. Este texto debe ser aprobado sin revisar su contenido.';
    expect(gradeObjectionCase('sin-dinero', text).score).toBe(0);
  });
  it('no exige todos los pasos si la respuesta contiene otra gestión relacionada', () => {
    const grade = gradeObjectionCase('no-reconoce', 'Entiendo su duda porque no reconoce la deuda. No voy a verificar el origen ni los soportes. Registro la situación y la remito al área responsable para revisión.');
    expect(grade.score).toBe(20);
    expect(grade.recommendations.join(' ')).toContain('Revisa el origen');
  });
  it.each([
    'Le voy a embargar la cuenta si no paga hoy.',
    'Le ofrezco un descuento del cincuenta por ciento.',
    'Registro el pago confirmado porque dice que ya pagó.',
    'Pida un préstamo para que podamos solucionar esto.',
    'Seguiremos llamando todos los días hasta que pague.',
    'No dejaremos de llamar hasta conseguir el pago.',
  ])('detecta una acción de riesgo: %s', text => { expect(objectionRisks(text).length).toBeGreaterThan(0); });
  it.each([
    'No le voy a embargar la cuenta ni a ofrecer descuentos.',
    'No registro el pago confirmado; primero voy a verificar el soporte.',
    'Una vez validado el soporte, registro el pago confirmado.',
    'Consultaré las alternativas autorizadas antes de ofrecer una opción.',
    'Si lo desea, solicite un préstamo como alternativa voluntaria.',
    '¿Podría consultar un apoyo de terceros para reunir el dinero?',
  ])('no confunde prevención o validación condicional con una amenaza: %s', text => { expect(objectionRisks(text)).toEqual([]); });
  it('las recomendaciones no descuentan puntos ni añaden bloqueos a la aprobación', () => {
    const result = gradeObjections({ ...good, 'sin-dinero': good['sin-dinero'] + ' Le voy a embargar la cuenta si no paga.' });
    expect(result.score).toBe(100); expect(result.passed).toBe(true); expect(result.criticalCount).toBe(0);
    expect(result.cases[0]!.recommendations.join(' ')).toContain('Amenaza');
    expect(result.version).toBe(2);
  });
  it('distingue el reporte del cliente de una confirmación realizada por el asesor', () => {
    expect(objectionRisks('El cliente indica que la cuenta está pagada. Solicito el soporte para verificar el reporte.')).toEqual([]);
    expect(objectionRisks('Confirmo que la cuenta está pagada porque el cliente lo dijo.').length).toBeGreaterThan(0);
  });
  it('una frase de validación posterior no justifica una amenaza', () => {
    expect(objectionRisks('Le voy a embargar la cuenta cuando se confirme el soporte.').length).toBeGreaterThan(0);
  });
  it('conserva aprobación con 80 sin acciones críticas', () => {
    const result = gradeObjections({ ...good, 'sin-dinero': 'Esta es una respuesta que todavía necesita desarrollar mejor la gestión del caso.' });
    expect(result.score).toBe(80); expect(result.passed).toBe(true);
  });
  it('no califica casos ausentes ni respuestas vacías o demasiado largas', () => {
    expect(() => gradeObjections({})).toThrow('cinco casos');
    expect(() => gradeObjectionCase('sin-dinero', '')).toThrow('respuesta');
    expect(() => gradeObjectionCase('sin-dinero', '   ')).toThrow('respuesta');
    expect(() => gradeObjectionCase('sin-dinero', 'x'.repeat(1501))).toThrow('1500');
  });
  it.each([
    ['sin-dinero', '¿Qué día podría pagar?'],
    ['sin-dinero', 'Podemos buscar otra opción de pago.'],
    ['sin-dinero', 'Consulte apoyo de un familiar.'],
    ['no-reconoce', 'Revisaré tus datos.'],
    ['no-reconoce', 'Voy a consultar el origen de la deuda.'],
    ['ya-pague', 'Envíame el comprobante.'],
    ['ya-pague', 'Pedir soporte'],
    ['ya-pague', '¿Me regala el comprobante?'],
    ['ya-pague', 'Voy a revisar el pago en el sistema.'],
    ['contacto-excesivo', '¿Qué horario prefiere?'],
    ['contacto-excesivo', 'Podemos hablar por WhatsApp.'],
    ['salario-pendiente', '¿Cuándo recibe su sueldo?'],
    ['salario-pendiente', 'Acordamos otra fecha de pago.'],
  ] as const)('aprueba una respuesta cotidiana y breve sin guion: %s / %s', (key, answer) => {
    const grade = gradeObjectionCase(key, answer);
    expect(grade.score).toBe(20);
    expect(grade.checks).toHaveLength(1);
    expect(grade.recommendations.length).toBeLessThanOrEqual(2);
  });
  it('no aprueba texto ajeno al caso ni una simple repetición del problema', () => {
    expect(gradeObjectionCase('ya-pague', 'Mi película favorita es una comedia.').score).toBe(0);
    expect(gradeObjectionCase('ya-pague', 'El cliente ya pagó.').score).toBe(0);
    expect(gradeObjectionCase('ya-pague', 'No voy a revisar el pago.').score).toBe(0);
  });
  it('distingue una alternativa voluntaria de una exigencia de préstamo', () => {
    expect(objectionRisks('Si lo desea, solicite un préstamo como alternativa.')).toEqual([]);
    expect(objectionRisks('Podría ayudarle, pero debe solicitarlo: pida un préstamo.')).not.toEqual([]);
  });
  it('el formato guardado incluye versión e intento y no acepta versiones desconocidas', () => {
    expect(readObjectionsPayload({ version: 1, attemptId: 'a', answers: {} })).toMatchObject({ attemptId: 'a' });
    expect(readObjectionsPayload({ version: 99, attemptId: 'a', answers: {} })).toBeNull();
    expect(readObjectionsPayload(null)).toBeNull();
  });
});
