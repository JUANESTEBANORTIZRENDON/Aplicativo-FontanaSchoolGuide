import { describe, expect, it } from 'vitest';
import { advanceGuidedCase, createGuidedCaseState, caseNote, GUIDED_BLOCKS, type GuidedBlockKey } from '../../src/collections/guided-case-model.js';

describe('Caso de Camila repartido entre los bloques 02 a 05', () => {
  it('mantiene los errores en el paso actual y terminar preparación no completa los otros bloques', () => {
    const state = createGuidedCaseState();
    state.balance = '480000';
    expect(advanceGuidedCase(state, 'preparacion')).not.toBe('');
    state.sourceOpen = true;
    expect(advanceGuidedCase(state, 'preparacion')).not.toBe('');
    expect(state.progress.preparacion.index).toBe(0);
    state.balance = '$400.000';
    expect(advanceGuidedCase(state, 'preparacion')).toBe('');
    expect(state.progress.preparacion.finished).toBe(true);
    for (const block of ['contacto', 'alternativas', 'seguimiento'] as const) {
      expect(state.progress[block]).toEqual({ index: 0, finished: false });
    }
  });

  it('permite recorrer los cuatro bloques con sus propias actividades, sin duplicar ni reiniciar avances', () => {
    const state = createGuidedCaseState();
    Object.assign(state, {
      sourceOpen: true, balance: '400000', holder: 'Camila Rojas', advisor: 'Patricia', portfolio: 'Marketing Personal',
      qualityAnswer: 'calidad', question: '¿Cómo está su situación para revisar las opciones autorizadas?',
      possibilityQuestion: '¿Qué monto y fecha considera posibles después de revisar sus ingresos?',
      optionsOpen: true, alternativeAction: 'consultar', summaryAnswer: 'consulta', outcome: 'sin-compromiso',
      nextAction: 'Consultar al coordinador la solicitud de descuento y registrar su respuesta.',
    });
    for (const block of Object.keys(GUIDED_BLOCKS) as GuidedBlockKey[]) {
      for (const _step of GUIDED_BLOCKS[block].steps) expect(advanceGuidedCase(state, block)).toBe('');
      expect(state.progress[block]).toEqual({ index: GUIDED_BLOCKS[block].steps.length, finished: true });
      const completed = structuredClone(state.progress);
      expect(advanceGuidedCase(state, block)).toBe('');
      expect(state.progress).toEqual(completed);
    }
    expect(caseNote(state)).toContain('sin compromiso de pago');
    expect(caseNote(state)).toContain('no hay descuento aprobado');
    expect(caseNote(state)).toContain(state.nextAction);
  });

  it('exige comprender el aviso de calidad antes de pasar a informar y escuchar', () => {
    const state = createGuidedCaseState();
    state.progress.contacto.index = 2;
    state.qualityAnswer = 'pago';
    expect(advanceGuidedCase(state, 'contacto')).toContain('no confirman un pago');
    expect(state.progress.contacto.index).toBe(2);
    state.qualityAnswer = 'calidad';
    expect(advanceGuidedCase(state, 'contacto')).toBe('');
    expect(state.progress.contacto).toEqual({ index: 3, finished: false });
  });

  it('exige consultar la ficha y no acepta aprobar un descuento que no tiene autorización', () => {
    const state = createGuidedCaseState();
    state.progress.alternativas.index = 1;
    state.alternativeAction = 'consultar';
    expect(advanceGuidedCase(state, 'alternativas')).toContain('Consulta primero');
    state.optionsOpen = true;
    state.alternativeAction = 'aprobar';
    expect(advanceGuidedCase(state, 'alternativas')).toContain('no confirma un descuento');
    expect(state.progress.alternativas.finished).toBe(false);
    state.alternativeAction = 'consultar';
    expect(advanceGuidedCase(state, 'alternativas')).toBe('');
    expect(state.progress.alternativas.finished).toBe(true);
    expect(state.progress.seguimiento.finished).toBe(false);
  });

  it('permite retomar un bloque habilitado tras recargar y rechaza confundir la consulta con un pago', () => {
    const state = createGuidedCaseState();
    // El servidor ya determina qué bloque puede abrirse; no necesita borradores de los anteriores.
    state.summaryAnswer = 'consulta';
    expect(advanceGuidedCase(state, 'seguimiento')).toBe('');
    state.outcome = 'confirmado';
    state.nextAction = 'Consultar la solicitud con el coordinador.';
    expect(advanceGuidedCase(state, 'seguimiento')).toContain('no confirma un nuevo pago');
    expect(state.progress.seguimiento.finished).toBe(false);
    state.outcome = 'sin-compromiso';
    expect(advanceGuidedCase(state, 'seguimiento')).toBe('');
    expect(caseNote(state)).toContain('saldo verificado de $400.000');
    expect(state.progress.contacto.index).toBe(0);
  });
});
