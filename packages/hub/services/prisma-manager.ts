import { PrismaClient } from '@prisma/client';
import config from 'config';
import { PrismaTestingHelper } from '@chax-at/transactional-prisma-testing';

export default class PrismaManager {
  private client?: PrismaClient;
  private prismaTestingHelper?: PrismaTestingHelper<PrismaClient>;

  dbConfig: Record<string, any> = config.get('db');

  async getClient() {
    if (!this.client) {
      let client = new PrismaClient({
        datasources: { db: { url: this.dbConfig.url } },
        log: this.dbConfig.prismaLog,
      });

      if (this.dbConfig.useTransactionalRollbacks) {
        this.prismaTestingHelper = new PrismaTestingHelper(client);
        await this.prismaTestingHelper.startNewTransaction();
        client = this.prismaTestingHelper.getProxyClient();
      }

      this.client = client;
    }
    return this.client;
  }

  async teardown() {
    this.prismaTestingHelper?.rollbackCurrentTransaction();
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'prisma-manager': PrismaManager;
  }
}
