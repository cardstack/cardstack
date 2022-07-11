import { PrismaClient as PrismaClientToWrap } from '@prisma/client';
import config from 'config';

export default class PrismaManager {
  private client: PrismaClientToWrap | undefined;

  dbConfig: Record<string, any> = config.get('db');

  getClient() {
    if (!this.client) {
      this.client = new PrismaClientToWrap({
        datasources: { db: { url: this.dbConfig.url } },
        log: ['query', 'info', 'warn', 'error'], // FIXME make this configurable somehow
      });
    }
    return this.client;
  }

  async teardown() {
    if (this.dbConfig.useTransactionalRollbacks && this.client) {
      const tablenames = await this.client.$queryRaw<
        { tablename: string }[]
      >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

      for (const { tablename } of tablenames) {
        if (tablename !== '_prisma_migrations') {
          try {
            await this.client.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`);
          } catch (error) {
            console.log({ error });
          }
        }
      }
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'prisma-manager': PrismaManager;
  }
}
