import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { prisma } from '../config/prisma.js';
import { CATALOG, seedCatalog, seedTestAdvisor } from '../../prisma/seed-base.js';

describe('Prisma y seed', () => {
  it('tiene aplicadas la línea base y la migración, sin cambios pendientes', () => {
    const status = execSync('npx prisma migrate status', { env: process.env, encoding: 'utf8' });
    expect(status).toMatch(/Database schema is up to date/);
    const url = new URL(process.env.DATABASE_URL!);
    url.searchParams.set('schema', 'induccion');
    const diff = execSync(`npx prisma migrate diff --from-url "${url.toString()}" --to-schema-datamodel prisma/schema.prisma --script`, { env: process.env, encoding: 'utf8' });
    expect(diff).toMatch(/empty migration/);
  });

  it('el seed base es repetible', async () => {
    const before = await Promise.all([prisma.trainingModule.count(), prisma.activity.count(), prisma.modulePrerequisite.count(), prisma.usuario.count()]);
    await seedCatalog(prisma);
    await seedTestAdvisor(prisma);
    const after = await Promise.all([prisma.trainingModule.count(), prisma.activity.count(), prisma.modulePrerequisite.count(), prisma.usuario.count()]);
    expect(after).toEqual(before);
    expect(before[0]).toBeGreaterThanOrEqual(CATALOG.length);
  });

  it('impide ciclos y autorreferencias en prerrequisitos', async () => {
    const { setPrerequisites } = await import('../services/catalog.service.js');
    const modules = await prisma.trainingModule.findMany({ orderBy: { order: 'asc' } });
    await expect(setPrerequisites(prisma, modules[0]!.id, [modules[0]!.id])).rejects.toMatchObject({ status: 400 });
    await expect(setPrerequisites(prisma, modules[0]!.id, [modules[2]!.id])).rejects.toMatchObject({ code: 'PREREQUISITE_CYCLE' });
  });

  it('mantiene los CHECK reales de usuarios', async () => {
    await expect(prisma.$executeRaw`UPDATE induccion.usuarios SET estado = 'otro' WHERE false`).resolves.toBe(0);
    await expect(prisma.usuario.create({ data: { nombreCompleto: 'TEST check', numeroDocumento: 'TEST-check-rol', passwordHash: 'x', rol: 'admin' } })).rejects.toThrow();
  });
});
