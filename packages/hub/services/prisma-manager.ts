import { PrismaClient } from '@prisma/client';
import config from 'config';
import { PrismaTestingHelper } from '@chax-at/transactional-prisma-testing';
import {
  ExtendedPushNotificationRegistration,
  getPushNotificationRegistrationExtension,
} from './prisma-extensions/push-notification-registration';
import { ExtendedLatestEventBlock, getLatestEventBlockExtension } from './prisma-extensions/latest-event-block';
import { ExtendedExchangeRate, getExchangeRateExtension } from './prisma-extensions/exchange-rate';

export interface ExtendedPrismaClient extends PrismaClient {
  exchangeRate: ExtendedExchangeRate;
  pushNotificationRegistration: ExtendedPushNotificationRegistration;
  latestEventBlock: ExtendedLatestEventBlock;
}

let dbConfig: Record<string, any> = config.get('db');

// Prisma client should be a singleton to avoid this problem:
// https://www.prisma.io/docs/concepts/components/prisma-client/working-with-prismaclient/instantiate-prisma-client#the-number-of-prismaclient-instances-matters

let singletonClient = new PrismaClient({
  datasources: { db: { url: dbConfig.url } },
  log: dbConfig.prismaLog,
}) as ExtendedPrismaClient;

// In tests, do not add extensions until the in-transaction proxy client exists

if (!dbConfig.useTransactionalRollbacks) {
  addCardstackPrismaExtensions(singletonClient);
}

export default class PrismaManager {
  private prismaTestingHelper?: PrismaTestingHelper<PrismaClient>;

  async getClient() {
    if (dbConfig.useTransactionalRollbacks) {
      // Set up transactional test helper with extensions if it doesn’t yet exist
      if (!this.prismaTestingHelper) {
        this.prismaTestingHelper = new PrismaTestingHelper(singletonClient);
        await this.prismaTestingHelper.startNewTransaction();

        let proxyClientToExtend = this.prismaTestingHelper.getProxyClient() as ExtendedPrismaClient;
        addCardstackPrismaExtensions(proxyClientToExtend);
      }

      return this.prismaTestingHelper.getProxyClient() as ExtendedPrismaClient;
    }

    return singletonClient;
  }

  async teardown() {
    this.prismaTestingHelper?.rollbackCurrentTransaction();
  }
}

function addCardstackPrismaExtensions(client: PrismaClient) {
  Object.assign(client.exchangeRate, getExchangeRateExtension(client));
  Object.assign(client.pushNotificationRegistration, getPushNotificationRegistrationExtension(client));
  Object.assign(client.latestEventBlock, getLatestEventBlockExtension(client));
}

declare module '@cardstack/di' {
  interface KnownServices {
    'prisma-manager': PrismaManager;
  }
}
