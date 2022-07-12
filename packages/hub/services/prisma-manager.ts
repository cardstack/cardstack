import { Prisma, PrismaClient } from '@prisma/client';
import config from 'config';
import { PrismaTestingHelper } from '@chax-at/transactional-prisma-testing';

// type upsertReturnType = ReturnType<typeof PrismaClient['push_notification_registrations'].upsert>;

// interface ExtendedPushNotificationRegistrations extends push_notification_registrationsDelegate {
//   upsertTest(id: string, owner_address: string, push_client_id: string, disabled_at: Date | null): upsertReturnType;
// }
// interface ExtendedPrismaClient extends PrismaClient {
//   push_notification_registrationsDelegate: ExtendedPushNotificationRegistrations;
// }

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

      Object.assign(client.push_notification_registrations, {
        upsertTest(id: string, owner_address: string, push_client_id: string, disabled_at?: Date) {
          console.log('!!', id, owner_address, push_client_id, disabled_at);
          return client.push_notification_registrations.upsert(
            Prisma.validator<Prisma.push_notification_registrationsUpsertArgs>()({
              where: {
                owner_address_push_client_id: {
                  owner_address,
                  push_client_id,
                },
              },
              create: {
                id: id,
                owner_address,
                push_client_id,
                disabled_at,
              },
              update: {
                disabled_at,
              },
            })
          );
        },
      });

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
