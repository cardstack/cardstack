import { PrismaClient as PrismaClientToWrap } from '@prisma/client';
import config from 'config';
import { Deferred } from '@cardstack/di';

export default class PrismaClient {
  private client: PrismaClientToWrap | undefined;
  private transactionClient: PrismaClientToWrap | undefined;
  private transactionDeferred: Deferred<any> | undefined;

  dbConfig: Record<string, any> = config.get('db');

  async getClient() {
    console.log('dbconf?', this.dbConfig);
    if (!this.client) {
      this.client = new PrismaClientToWrap({ datasources: { db: { url: this.dbConfig.url } } });

      if (this.dbConfig.useTransactionalRollbacks) {
        // await this.client.$executeRawUnsafe('START TRANSACTION');
        console.log('pretrans');
        this.client.$transaction(async (prisma: any) => {
          console.log('inside transaction!! oink');
          this.transactionClient = prisma;
          this.transactionDeferred = new Deferred();
          console.log('about to await deferred');
          let xx = await this.transactionDeferred.promise;
          console.log('got deferred', xx);
          return this.transactionDeferred.promise;
        });
        console.log('postr');
      }
    }

    return this.transactionClient || this.client;
  }

  async teardown() {
    if (this.dbConfig.useTransactionalRollbacks) {
      console.log('teardown!');
      this.transactionDeferred?.reject('FAIL');
      // await this.client?.$executeRawUnsafe('ROLLBACK');
    }
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'prisma-client': PrismaClient;
  }
}
