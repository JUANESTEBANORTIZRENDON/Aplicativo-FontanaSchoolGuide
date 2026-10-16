// Crea una versión nueva de la configuración del módulo de Ofimática con el mismo servicio que usa el panel
// (updateConfig): valida límites, archiva la versión anterior, ajusta las evaluaciones afectadas y audita.
//
//   npx tsx server/scripts/office-config.ts --set dictationMaxPlays=6 --set dictationMaxAttempts=1 \
//     --reason "Motivo del cambio" --admin-documento <documento de un administrador>
import { OFFICE_CONFIG_LIMITS, type OfficeConfigValues } from '../domain/office.js';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const value = (flag: string) => { const index = argv.indexOf(flag); return index >= 0 ? argv[index + 1] ?? null : null; };
  const changes: Partial<OfficeConfigValues> = {};
  argv.forEach((arg, index) => {
    if (arg !== '--set') return;
    const [key, raw] = (argv[index + 1] ?? '').split('=');
    if (!key || raw === undefined || !(key in OFFICE_CONFIG_LIMITS)) throw new Error(`Valor inválido: ${argv[index + 1] ?? ''}. Usa --set clave=valor.`);
    const limit = OFFICE_CONFIG_LIMITS[key as keyof OfficeConfigValues];
    const number = Number(raw);
    if (!Number.isFinite(number) || number < limit.min || number > limit.max || (limit.integer && !Number.isInteger(number))) {
      throw new Error(`${key} debe estar entre ${limit.min} y ${limit.max}${limit.integer ? ' (entero)' : ''}.`);
    }
    changes[key as keyof OfficeConfigValues] = number;
  });
  const reason = value('--reason');
  const documento = value('--admin-documento');
  if (!Object.keys(changes).length || !reason || reason.trim().length < 10 || !documento) {
    throw new Error('Uso: --set clave=valor (una o más) --reason "<al menos 10 caracteres>" --admin-documento <documento>.');
  }

  const { prisma, disconnect } = await import('../config/prisma.js');
  const { updateConfig } = await import('../services/office-config.service.js');
  const { esAdministrador } = await import('../domain/enums.js');
  try {
    const admin = await prisma.usuario.findUnique({ where: { numeroDocumento: documento }, select: { id: true, rol: true, estado: true } });
    if (!admin || !esAdministrador(admin.rol) || admin.estado !== 'activo') throw new Error('El documento indicado no corresponde a un administrador activo.');
    const result = await updateConfig(changes, reason.trim(), { actorUserId: admin.id, requestId: 'office-config-script', ip: '127.0.0.1' });
    console.log(`Configuración versión ${result.config.version} activa. Cambios: ${result.changed.join(', ')}.`);
    for (const evaluation of result.evaluations) console.log(`Evaluación nueva: ${evaluation.section} v${evaluation.version}`);
  } finally {
    await disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
