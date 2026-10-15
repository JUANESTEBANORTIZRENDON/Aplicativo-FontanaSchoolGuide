/** @deprecated Usa server/config/prisma.ts. Re-export temporal para código que aún lo importe. */
import { checkConnection, disconnect, prisma } from '../config/prisma.js';

export const databaseModel = { client: prisma, checkConnection, disconnect };
