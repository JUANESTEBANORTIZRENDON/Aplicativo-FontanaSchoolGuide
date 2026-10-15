// Protección común de seeds y pruebas: nunca escribir datos ficticios en producción.
//  - Aborta con NODE_ENV=production.
//  - Exige SEED_ALLOW=true.
//  - Rechaza cualquier host listado en PRODUCTION_DATABASE_HOSTS.
//  - Solo acepta localhost o hosts listados explícitamente en SEED_ALLOWED_HOSTS
//    (por ejemplo, el host de la rama de pruebas de Neon).

function hostOf(url: string | undefined): string {
  if (!url) return '';
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

function list(value: string | undefined): string[] {
  return (value ?? '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
}

export function assertSafeDatabase(purpose: string, url = process.env.DATABASE_URL): string {
  const fail = (reason: string): never => {
    throw new Error(`[${purpose}] Abortado: ${reason}`);
  };
  if (process.env.NODE_ENV === 'production') fail('NODE_ENV=production.');
  if (process.env.SEED_ALLOW !== 'true') fail('define SEED_ALLOW=true para confirmar que la base no es de producción.');
  const host = hostOf(url);
  if (!host) fail('DATABASE_URL no está definida o no es válida.');
  if (list(process.env.PRODUCTION_DATABASE_HOSTS).includes(host)) fail(`el host ${host} está marcado como producción.`);
  const local = ['localhost', '127.0.0.1', '::1'].includes(host);
  if (!local && !list(process.env.SEED_ALLOWED_HOSTS).includes(host)) {
    fail(`el host ${host} no es local ni está en SEED_ALLOWED_HOSTS. Agrega ahí el host de la rama de pruebas de Neon.`);
  }
  return host;
}
