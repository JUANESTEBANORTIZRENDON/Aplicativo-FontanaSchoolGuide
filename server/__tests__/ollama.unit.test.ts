import { describe, expect, it } from 'vitest';
import { SPELLING_RULES } from '../../prisma/seed-office-content.js';
import { evaluateDictation, type SpellingRuleInput } from '../domain/spelling/engine.js';
import { requestRecommendation, type OllamaConfig, type OllamaInput } from '../integrations/ollama.js';
import { buildRecommendation, toOllamaInput } from '../services/office-dictation.service.js';

// Servidor de Ollama simulado: ninguna prueba abre la red.
const config: OllamaConfig = { enabled: true, url: 'http://ollama.interno:11434', model: 'modelo-de-prueba', timeoutMs: 80 };
const input: OllamaInput = { score: 85, minScore: 85, passed: false, criticalCount: 1, categories: { HOMOFONA: 1 }, topErrors: [], examples: [] };
const rules: SpellingRuleInput[] = SPELLING_RULES.map((rule) => ({
  key: rule.key, category: rule.category, severity: rule.severity, weight: rule.weight, pairs: rule.pairs, explanation: rule.explanation, examples: rule.examples,
}));
const evaluation = evaluateDictation('El cliente dice que debe haber un error en el saldo.', 'El cliente dice que debe a ver un error en el saldo.', rules, { minScore: 85 });

const reply = (content: unknown, status = 200): typeof fetch => (async () => new Response(JSON.stringify({ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }), { status })) as unknown as typeof fetch;
const valid = { resumen: 'Obtuviste 85 puntos, pero hay un error crítico.', fortalezas: ['Escribiste bien casi todo.'], recomendaciones: ['Usa «haber» cuando sea el verbo.'], proximoPaso: 'Repasa a ver y haber.' };

describe('Ollama: solo redacta, nunca califica', () => {
  it('desactivado: no llama a la red', async () => {
    let calls = 0;
    const fetchImpl = (async () => { calls += 1; return new Response('{}'); }) as unknown as typeof fetch;
    expect(await requestRecommendation(input, { config: { ...config, enabled: false }, fetchImpl })).toBeNull();
    expect(calls).toBe(0);
  });

  it('acepta una respuesta válida y envía solo el contrato esperado', async () => {
    let body: { model: string; stream: boolean; options: { temperature: number }; format: unknown; messages: { role: string; content: string }[] } | null = null;
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      body = JSON.parse(init.body as string);
      return new Response(JSON.stringify({ message: { content: JSON.stringify(valid) } }));
    }) as unknown as typeof fetch;
    const result = await requestRecommendation(input, { config, fetchImpl });
    expect(result).toEqual(valid);
    expect(body!.stream).toBe(false);
    expect(body!.options.temperature).toBeLessThanOrEqual(0.1);
    expect(body!.format).toMatchObject({ type: 'object', additionalProperties: false });
    expect(body!.messages[0]!.role).toBe('system');
  });

  it('descarta JSON inválido, campos extra y recomendaciones demasiado largas', async () => {
    expect(await requestRecommendation(input, { config, fetchImpl: reply('esto no es json') })).toBeNull();
    expect(await requestRecommendation(input, { config, fetchImpl: reply({ ...valid, nota: 100 }) })).toBeNull();
    expect(await requestRecommendation(input, { config, fetchImpl: reply({ ...valid, recomendaciones: ['x'.repeat(181)] }) })).toBeNull();
    expect(await requestRecommendation(input, { config, fetchImpl: reply({ ...valid, recomendaciones: ['a', 'b', 'c', 'd'] }) })).toBeNull();
    expect(await requestRecommendation(input, { config, fetchImpl: reply(valid, 500) })).toBeNull();
  });

  it('reintenta una sola vez', async () => {
    let calls = 0;
    const flaky = (async () => { calls += 1; if (calls === 1) throw new Error('caída'); return new Response(JSON.stringify({ message: { content: JSON.stringify(valid) } })); }) as unknown as typeof fetch;
    expect(await requestRecommendation(input, { config, fetchImpl: flaky })).toEqual(valid);
    expect(calls).toBe(2);
    calls = 0;
    const down = (async () => { calls += 1; throw new Error('caída'); }) as unknown as typeof fetch;
    expect(await requestRecommendation(input, { config, fetchImpl: down })).toBeNull();
    expect(calls).toBe(2);
  });

  it('el tiempo agotado cae a la plantilla sin cambiar la nota', async () => {
    const slow = ((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    })) as unknown as typeof fetch;
    const started = Date.now();
    const built = await buildRecommendation(evaluation, 85, rules, { config, fetchImpl: slow });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(built.source).toBe('TEMPLATE');
    expect(built.promptVersion).toBeNull();
    expect(built.recommendation.recomendaciones.length).toBeGreaterThan(0);
    expect(evaluation.score).toBe(85);
    expect(evaluation.passed).toBe(false);
  });

  it('con una respuesta válida usa Ollama y registra la versión del prompt; la nota no cambia', async () => {
    const before = JSON.stringify(evaluation);
    const built = await buildRecommendation(evaluation, 85, rules, { config, fetchImpl: reply(valid) });
    expect(built).toMatchObject({ source: 'OLLAMA', promptVersion: 'recomendacion-ortografia.v1' });
    expect(built.recommendation).toEqual(valid);
    expect(JSON.stringify(evaluation)).toBe(before);
  });

  it('nunca envía el texto completo escrito ni datos personales', () => {
    const payload = toOllamaInput(evaluation, 85, rules);
    const text = JSON.stringify(payload);
    expect(text).not.toContain('El cliente dice que debe a ver un error en el saldo');
    expect(Object.keys(payload).sort()).toEqual(['categories', 'criticalCount', 'examples', 'minScore', 'passed', 'score', 'topErrors']);
    expect(payload.topErrors.length).toBeLessThanOrEqual(3);
  });
});
