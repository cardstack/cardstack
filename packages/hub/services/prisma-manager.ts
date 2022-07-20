import { PrismaClient } from '@prisma/client';
import config from 'config';
import { PrismaTestingHelper } from '@chax-at/transactional-prisma-testing';
import {
  ExtendedPushNotificationRegistration,
  getPushNotificationRegistrationExtension,
} from './prisma-extensions/push-notification-registration';
import { ExtendedLatestEventBlock, getLatestEventBlockExtension } from './prisma-extensions/latest-event-block';
import { ExtendedExchangeRate, getExchangeRateExtension } from './prisma-extensions/exchange-rate';
import {
  ExtendedNotificationPreference,
  getNotificationPreferenceExtension,
} from './prisma-extensions/notification-preference';

export interface ExtendedPrismaClient extends PrismaClient {
  exchangeRate: ExtendedExchangeRate;
  notificationPreference: ExtendedNotificationPreference;
  pushNotificationRegistration: ExtendedPushNotificationRegistration;
  latestEventBlock: ExtendedLatestEventBlock;
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

      this.addCardstackPrismaExtensions(client);

      this.client = client as ExtendedPrismaClient;
    }

    return this.client;
  }

  async teardown() {
    this.prismaTestingHelper?.rollbackCurrentTransaction();
    // TODO CS-4254
    // warn(prisma-client) There are already 10 instances of Prisma Client actively running.
    return this.client?.$disconnect();
  }

  private addCardstackPrismaExtensions(client: PrismaClient) {
    Object.assign(client.exchangeRate, getExchangeRateExtension(client));
    Object.assign(client.notificationPreference, getNotificationPreferenceExtension(client));
    Object.assign(client.pushNotificationRegistration, getPushNotificationRegistrationExtension(client));
    Object.assign(client.latestEventBlock, getLatestEventBlockExtension(client));
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'prisma-manager': PrismaManager;
  }
}
