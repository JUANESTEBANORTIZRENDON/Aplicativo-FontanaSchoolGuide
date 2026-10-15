import { prisma } from '../config/prisma.js';

// Consultas de la ficha del asesor. Todas acotadas al usuario y con límite.

export function activityProgressDetail(userId: string) {
  return prisma.userActivityProgress.findMany({
    where: { userId },
    include: { activity: { select: { id: true, title: true, type: true, status: true, moduleId: true, order: true } } },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
}

export function attemptsDetail(userId: string, take = 100) {
  return prisma.attempt.findMany({
    where: { userId },
    include: { evaluation: { select: { version: true, minimumScore: true, activity: { select: { id: true, title: true, moduleId: true } } } } },
    orderBy: [{ startedAt: 'desc' }, { number: 'desc' }],
    take,
  });
}

export function sealsDetail(userId: string) {
  return prisma.seal.findMany({ where: { userId }, include: { module: { select: { slug: true, name: true } } }, orderBy: { issuedAt: 'desc' }, take: 50 });
}

export function certificatesDetail(userId: string) {
  return prisma.certificate.findMany({ where: { userId }, orderBy: { issuedAt: 'desc' }, take: 50 });
}

export function overridesDetail(userId: string) {
  return prisma.userActivityOverride.findMany({
    where: { userId },
    include: {
      activity: { select: { id: true, title: true, module: { select: { name: true, slug: true } } } },
      createdBy: { select: { id: true, nombreCompleto: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export function typingResultsDetail(userId: string) {
  return prisma.typingResult.findMany({
    where: { userId },
    select: { id: true, providerEventId: true, wpm: true, accuracy: true, errors: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
}
