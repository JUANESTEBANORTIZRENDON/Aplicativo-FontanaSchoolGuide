import { describe, expect, it } from 'vitest';
import { COLLECTIONS_EXAM, gradeExam } from '../domain/collections-exam.js';
import { buildExamCoaching, readExamCoaching, readExamResult } from '../domain/collections-exam-report.js';
import { examAttemptHtml } from '../../src/admin/collections-admin.js';

const good = () => Object.fromEntries(COLLECTIONS_EXAM.map((q) => [q.key, q.kind === 'text' ? q.example : q.options.find((o) => o.correct)!.id]));

describe('informe individual del examen de cobranzas', () => {
  it('vincula cada fortaleza a una respuesta correcta con evidencia visible guardada', () => {
    const result = gradeExam(good()); const coaching = buildExamCoaching(result);
    expect(coaching.strengths).toHaveLength(COLLECTIONS_EXAM.length);
    expect(coaching.improvements).toEqual([]);
    for (const strength of coaching.strengths) {
      const response = result.sections.flatMap((s) => s.results).find((r) => r.key === strength.key)!;
      expect(strength.evidence).toBe(response.selectedText); expect(response.correct).toBe(true);
    }
    expect(readExamCoaching(JSON.parse(JSON.stringify(coaching)))).toEqual(coaching);
  });

  it('genera refuerzos distintos para personas con el mismo puntaje y errores diferentes', () => {
    const a = gradeExam({ ...good(), 'inicio-accion': 'ordenar' });
    const b = gradeExam({ ...good(), 'escenario-saldo': '480' });
    expect(a.score).toBe(b.score);
    const reportA = buildExamCoaching(a); const reportB = buildExamCoaching(b);
    expect(reportA.improvements[0]!.key).toBe('inicio-accion');
    expect(reportB.improvements[0]!.key).toBe('escenario-saldo');
    expect(reportA.improvements[0]!.recommendation).not.toBe(reportB.improvements[0]!.recommendation);
    expect(reportB.improvements[0]!.recommendation).toContain('$400.000');
  });

  it('destaca errores críticos sin atribuirles fortalezas y prioriza su refuerzo', () => {
    const report = buildExamCoaching(gradeExam({ ...good(), 'inicio-accion': 'ordenar', 'negociacion-descuento': 'aprobar' }));
    expect(report.improvements[0]!).toMatchObject({ key: 'negociacion-descuento', priority: 'critical' });
    expect(report.improvements[0]!.evidence).toContain('30 %');
    expect(report.strengths.some((s) => s.key === 'negociacion-descuento')).toBe(false);
  });

  it('reconoce logros parciales de redacción y recomienda los elementos faltantes', () => {
    const report = buildExamCoaching(gradeExam({ ...good(), 'inicio-guion': 'Buenos días.' }));
    const strength = report.strengths.find((s) => s.key === 'inicio-guion')!;
    expect(strength.description).toContain('Saludo respetuoso');
    expect(strength.description).not.toContain('Presentación con nombre');
    expect(report.improvements.find((s) => s.key === 'inicio-guion')!.missingCriteria).toContain('Presentación con nombre');
  });

  it('lee el resultado histórico sin recalificarlo y rechaza datos incompletos', () => {
    const saved = gradeExam({ ...good(), 'inicio-accion': 'ordenar' });
    const read = readExamResult(JSON.parse(JSON.stringify(saved)))!;
    expect(read.score).toBe(95); expect(read.sections[0]!.results[0]!.selectedText).toContain('sin saludar');
    expect(readExamResult({ ...saved, sections: [] })).toBeNull();
    expect(readExamResult({ ...saved, score: 20 })).toBeNull();
    expect(readExamResult({ ...saved, verdict: 'Inventado' })).toBeNull();
  });

  it('escapa nombres y respuestas escritas al mostrar el informe administrativo', () => {
    const result = readExamResult(gradeExam({ ...good(), 'inicio-guion': '<img src=x onerror=alert(1)>' }))!;
    const html = examAttemptHtml({ advisor: { id: 'u', name: '<script>alert(1)</script>', document: '123' }, id: 'attempt', attempt: 1, submittedAt: '2026-10-19T10:00:00Z', version: 2, score: result.score, verdict: result.verdict, detailAvailable: true, sections: [], result, coaching: buildExamCoaching(result), coachingSaved: true });
    expect(html).not.toContain('<script>'); expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img'); expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Desempeño en las 7 secciones');
  });
});
