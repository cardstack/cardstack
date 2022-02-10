import { PrismaClient as PrismaClientToWrap } from '@prisma/client';
import config from 'config';

export default class PrismaClient {
  private client: PrismaClientToWrap | undefined;

  dbConfig: Record<string, any> = config.get('db');

  async getClient() {
    console.log('dbconf?', this.dbConfig);
    if (!this.client) {
      this.client = new PrismaClientToWrap({ datasources: { db: { url: this.dbConfig.url } } });

      if (this.dbConfig.useTransactionalRollbacks) {
        await this.client.$executeRawUnsafe('START TRANSACTION');
      }
    }
    return this.client;
  }

  async teardown() {
    if (this.dbConfig.useTransactionalRollbacks) {
      this.client?.$executeRawUnsafe('ROLLBACK');
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'prisma-client': PrismaClient;
  }
}
