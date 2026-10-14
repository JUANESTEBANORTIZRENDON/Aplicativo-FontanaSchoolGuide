import { PrismaClient } from '@prisma/client';

class DatabaseModel {
  readonly client = new PrismaClient();

  async checkConnection(): Promise<void> {
    await this.client.$queryRaw`SELECT 1`;
  }

  async disconnect(): Promise<void> {
    await this.client.$disconnect();
  }
}

export const databaseModel = new DatabaseModel();
