import { tmpdir } from 'node:os';
import path from 'node:path';
import { config } from 'dotenv';
import { assertSafeDatabase } from '../../prisma/guard.js';

export const TEST_WEBHOOK_SECRET = 'test-typing-webhook-secret-0123456789';

// Redirige DATABASE_URL a la base de pruebas antes de cargar Prisma. Nunca usa la base de .env.
export function useTestDatabase(): void {
  config({ quiet: true });
  const url = process.env.DATABASE_URL_TEST;
  if (!url) throw new Error('Define DATABASE_URL_TEST (rama de pruebas de Neon o PostgreSQL local) para ejecutar npm test.');
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = process.env.DIRECT_URL_TEST || url;
  process.env.NODE_ENV = 'test';
  process.env.SEED_ALLOW = 'true';
  process.env.TYPING_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
  process.env.SESSION_SECRET ||= 'secreto-de-pruebas-con-mas-de-32-caracteres';
  process.env.CERTIFICATES_ENABLED = 'false';
  // Audios e imágenes de prueba en una carpeta temporal; Ollama y la voz de prueba, desactivados.
  process.env.STORAGE_DIR = path.join(tmpdir(), 'fontana-test-storage');
  process.env.DICTATION_DEV_TTS = 'false';
  process.env.OLLAMA_ENABLED = 'false';
  process.env.TRUST_PROXY = 'false';
  assertSafeDatabase('npm test', url);
}
