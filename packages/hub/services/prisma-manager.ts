import { Prisma, PrismaClient } from '@prisma/client';
import config from 'config';
import { PrismaTestingHelper } from '@chax-at/transactional-prisma-testing';

type push_notification_registrations_getter = Prisma.push_notification_registrationsDelegate<any>;
// FIXME this is <GlobalRejectSettings> but how to import?

interface ExtendedPushNotificationRegistrations extends push_notification_registrations_getter {
  upsertByOwnerAndPushClient({
    id,
    owner_address,
    push_client_id,
    disabled_at,
  }: {
    id: string;
    owner_address: string;
    push_client_id: string;
    disabled_at: Date | null;
  }): ReturnType<push_notification_registrations_getter['upsert']>;
}

export interface ExtendedPrismaClient extends PrismaClient {
  push_notification_registrations: ExtendedPushNotificationRegistrations;
}

export default class PrismaManager {
  private client?: ExtendedPrismaClient;
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
        upsertByOwnerAndPushClient({
          id,
          owner_address,
          push_client_id,
          disabled_at = null,
        }: {
          id: string;
          owner_address: string;
          push_client_id: string;
          disabled_at: Date | null;
        }) {
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

      this.client = client as ExtendedPrismaClient;
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
