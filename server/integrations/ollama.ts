import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { env } from '../config/env.js';
import type { Recommendation } from '../domain/spelling/recommendations.js';

// Ollama local, solo para redactar recomendaciones sobre un resultado YA calculado por el sistema experto.
// Nunca califica, aprueba ni modifica registros. Corre en la red privada: la URL, el modelo y cualquier
// token no salen del servidor. Si falla, tarda o está desactivado, se usa la plantilla determinística.

export const RECOMMENDATION_PROMPT_VERSION = 'recomendacion-ortografia.v1';
const PROMPT_FILE = `${RECOMMENDATION_PROMPT_VERSION}.md`;

export const recommendationSchema = z.object({
  resumen: z.string().trim().min(1).max(240),
  fortalezas: z.array(z.string().trim().min(1).max(180)).max(3),
  recomendaciones: z.array(z.string().trim().min(1).max(180)).min(1).max(3),
  proximoPaso: z.string().trim().min(1).max(180),
}).strict();

// Mismo contrato como JSON Schema para el parámetro format de Ollama.
const FORMAT = {
  type: 'object',
  additionalProperties: false,
  required: ['resumen', 'fortalezas', 'recomendaciones', 'proximoPaso'],
  properties: {
    resumen: { type: 'string', maxLength: 240 },
    fortalezas: { type: 'array', maxItems: 3, items: { type: 'string', maxLength: 180 } },
    recomendaciones: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string', maxLength: 180 } },
    proximoPaso: { type: 'string', maxLength: 180 },
  },
} as const;

// Entrada mínima: nunca nombre, cédula, teléfono, correo, audio ni el texto completo escrito.
export type OllamaInput = {
  score: number;
  minScore: number;
  passed: boolean;
  criticalCount: number;
  categories: Record<string, number>;
  topErrors: { type: string; expected: string; written: string; explanation: string }[];
  examples: { incorrect: string; correct: string }[];
};

export type OllamaConfig = { enabled: boolean; url?: string; model: string; timeoutMs: number };
export const defaultOllamaConfig = (): OllamaConfig => ({ enabled: env.OLLAMA_ENABLED, url: env.OLLAMA_URL, model: env.OLLAMA_MODEL, timeoutMs: env.OLLAMA_TIMEOUT_MS });

let promptCache: string | null = null;
function loadPrompt(): string {
  if (promptCache) return promptCache;
  const here = path.dirname(fileURLToPath(import.meta.url));
  // En desarrollo vive junto a este archivo; compilado, se lee del código fuente del repositorio.
  const candidates = [path.join(here, 'prompts', PROMPT_FILE), path.resolve(here, '..', '..', 'server', 'integrations', 'prompts', PROMPT_FILE)];
  for (const candidate of candidates) {
    try { promptCache = readFileSync(candidate, 'utf8'); return promptCache; } catch { /* siguiente ruta */ }
  }
  throw new Error(`No se encontró el prompt ${PROMPT_FILE}.`);
}

export type OllamaOptions = { config?: OllamaConfig; fetchImpl?: typeof fetch; requestId?: string };

function log(event: Record<string, unknown>): void {
  if (process.env.NODE_ENV === 'test') return;
  console.info(JSON.stringify({ event: 'ollama_recommendation', at: new Date().toISOString(), ...event }));
}

async function call(config: OllamaConfig, body: string, fetchImpl: typeof fetch): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetchImpl(`${config.url!.replace(/\/$/, '')}/api/chat`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Ollama respondió ${response.status}`);
    const data = await response.json() as { message?: { content?: unknown } };
    const content = data.message?.content;
    if (typeof content !== 'string') throw new Error('Respuesta sin contenido');
    return JSON.parse(content);
  } finally {
    clearTimeout(timer);
  }
}

// Devuelve la recomendación validada o null (desactivado, error, tiempo agotado o respuesta inválida).
export async function requestRecommendation(input: OllamaInput, options: OllamaOptions = {}): Promise<Recommendation | null> {
  const config = options.config ?? defaultOllamaConfig();
  if (!config.enabled || !config.url) return null;
  const fetchImpl = options.fetchImpl ?? fetch;
  const body = JSON.stringify({
    model: config.model, stream: false, format: FORMAT,
    options: { temperature: 0.1 },
    messages: [{ role: 'system', content: loadPrompt() }, { role: 'user', content: JSON.stringify(input) }],
  });
  // Un único reintento.
  for (let attempt = 1; attempt <= 2; attempt++) {
    const started = Date.now();
    try {
      const parsed = recommendationSchema.safeParse(await call(config, body, fetchImpl));
      if (parsed.success) { log({ ok: true, attempt, latencyMs: Date.now() - started, requestId: options.requestId }); return parsed.data; }
      log({ ok: false, attempt, latencyMs: Date.now() - started, requestId: options.requestId, error: 'invalid_schema' });
    } catch (error) {
      log({ ok: false, attempt, latencyMs: Date.now() - started, requestId: options.requestId, error: error instanceof Error ? error.name : 'unknown' });
    }
  }
  return null;
}
