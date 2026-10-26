import { describe, expect, it } from 'vitest';
import { OBJECTIONS_BLOCKS } from '../../server/domain/objections';
import { OBJECTION_DECKS } from './content';

// Biblioteca anterior conservada como referencia; el recorrido activo usa los cinco casos escritos.
describe('biblioteca de referencia de objeciones', () => {
  const textOf = (value: unknown) => JSON.stringify(value);

  it('cada bloque tiene diapositivas con título e ícono, y ninguna evaluación', () => {
    for (const key of Object.keys(OBJECTION_DECKS)) {
      const deck = OBJECTION_DECKS[key]!;
      expect(deck.length).toBeGreaterThanOrEqual(5);
      for (const slide of deck) {
        expect(slide.title.length).toBeGreaterThan(3);
        expect(slide.icon).toContain('<svg');
        expect(Boolean(slide.html) || Boolean(slide.lead)).toBe(true);
      }
    }
    expect(textOf(OBJECTION_DECKS).toLowerCase()).not.toMatch(/reto r[aá]pido|examen/);
    expect(OBJECTIONS_BLOCKS.every((block) => block.objective.length > 30)).toBe(true);
  });

  it('el bloque 4 presenta los 13 casos, uno por diapositiva y con las cuatro partes', () => {
    const cases = OBJECTION_DECKS.casos!.filter((slide) => (slide.html ?? '').includes('class="deck-case"'));
    expect(cases).toHaveLength(13);
    for (const slide of cases) {
      for (const part of ['Qué debes comprender', 'Qué debes validar', 'Una forma correcta de responder', 'Qué no debes asegurar ni prometer']) expect(slide.html).toContain(part);
    }
    const all = textOf(cases).toLowerCase();
    for (const fragment of ['siempre pago antes de terminar el mes', 'grabaciones', 'servicio al cliente', 'nómina', 'abono', 'factura', 'reclamación', 'pagué hace poco', 'descuento', 'refinanciar', 'cancelé el servicio']) {
      expect(all).toContain(fragment);
    }
    expect(all).toMatch(/suspens/);
    expect(all).toMatch(/desconex/);
    expect(all).toMatch(/bloque/);
  });

  it('explica los cinco tipos y destaca que la preventiva queda fuera de la operación', () => {
    const tipos = textOf(OBJECTION_DECKS.tipos);
    for (const name of ['Preventiva', 'Administrativa', 'Prejurídica', 'Castigada', 'Judicializada']) expect(tipos).toContain(name);
    expect(tipos).toContain('Fontana maneja cobranza administrativa, prejurídica, castigada y judicializada. La cobranza preventiva no hace parte de la operación de este módulo ni de la gestión actual de la empresa.');
    expect(OBJECTION_DECKS.tipos!.some((slide) => slide.tone === 'excluded')).toBe(true);
    // «Preventiva» solo se menciona en el bloque donde se explica como tipo excluido.
    for (const key of ['comprender', 'criterio', 'casos']) expect(textOf(OBJECTION_DECKS[key]).toLowerCase()).not.toContain('preventiv');
  });

  it('enseña la secuencia de seis pasos y lo que no se promete sin autorización', () => {
    const html = textOf(OBJECTION_DECKS.comprender);
    for (const step of ['Escuchar sin interrumpir', 'Validar la inquietud con respeto', 'pregunta breve', 'fuente autorizada', 'respuesta clara', 'siguiente paso']) expect(html).toContain(step);
    for (const forbidden of ['Descuentos', 'Acuerdos', 'Eliminación de cobros', 'Cambios de saldo', 'Suspensión de gestiones']) expect(html).toContain(forbidden);
  });

  it('usa lenguaje genérico y no conserva el nombre antiguo del módulo', () => {
    const everything = textOf([OBJECTION_DECKS, OBJECTIONS_BLOCKS]);
    expect(everything).not.toContain('Simulador');
    expect(everything).toContain('sistema autorizado');
    expect(everything).toContain('cartera asignada');
    expect(everything).toContain('procedimiento interno');
  });
});
