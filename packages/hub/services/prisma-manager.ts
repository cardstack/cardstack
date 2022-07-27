import { PrismaClient } from '@prisma/client';
import config from 'config';
import { PrismaTestingHelper } from '@chax-at/transactional-prisma-testing';
import {
  ExtendedPushNotificationRegistration,
  getPushNotificationRegistrationExtension,
} from './prisma-extensions/push-notification-registration';
import { ExtendedLatestEventBlock, getLatestEventBlockExtension } from './prisma-extensions/latest-event-block';
import { ExtendedExchangeRate, getExchangeRateExtension } from './prisma-extensions/exchange-rate';
import { ExtendedUpload, getUploadExtension } from './prisma-extensions/upload';
import {
  ExtendedNotificationPreference,
  getNotificationPreferenceExtension,
} from './prisma-extensions/notification-preference';
import { ExtendedEmailCardDropState, getEmailCardDropStateExtension } from './prisma-extensions/email-card-drop-state';
import {
  ExtendedEmailCardDropRequest,
  getEmailCardDropRequestExtension,
} from './prisma-extensions/email-card-drop-requests';

export interface ExtendedPrismaClient extends PrismaClient {
  emailCardDropRequest: ExtendedEmailCardDropRequest;
  emailCardDropState: ExtendedEmailCardDropState;
  exchangeRate: ExtendedExchangeRate;
  notificationPreference: ExtendedNotificationPreference;
  pushNotificationRegistration: ExtendedPushNotificationRegistration;
  latestEventBlock: ExtendedLatestEventBlock;
  upload: ExtendedUpload;
}

let dbConfig: Record<string, any> = config.get('db');

// Prisma client should be a singleton to avoid this problem:
// https://www.prisma.io/docs/concepts/components/prisma-client/working-with-prismaclient/instantiate-prisma-client#the-number-of-prismaclient-instances-matters

let singletonClient = new PrismaClient({
  datasources: { db: { url: dbConfig.url } },
  log: dbConfig.prismaLog,
});

singletonClient.$on('query', (e: any) => {
  console.log('Query: ' + e.query);
  console.log('Params: ' + e.params);
  console.log('Duration: ' + e.duration + 'ms');
});

export default class PrismaManager {
  private prismaTestingHelper?: PrismaTestingHelper<PrismaClient>;

  async ready() {
    // In tests, do not add extensions until the in-transaction proxy client exists

    if (!dbConfig.useTransactionalRollbacks) {
      addCardstackPrismaExtensions(singletonClient);
    }
  }

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

    return singletonClient as ExtendedPrismaClient;
  }

  async teardown() {
    this.prismaTestingHelper?.rollbackCurrentTransaction();
  }
}

function addCardstackPrismaExtensions(client: PrismaClient) {
  Object.assign(client.emailCardDropRequest, getEmailCardDropRequestExtension(client));
  Object.assign(client.emailCardDropState, getEmailCardDropStateExtension(client));
  Object.assign(client.exchangeRate, getExchangeRateExtension(client));
  Object.assign(client.notificationPreference, getNotificationPreferenceExtension(client));
  Object.assign(client.pushNotificationRegistration, getPushNotificationRegistrationExtension(client));
  Object.assign(client.latestEventBlock, getLatestEventBlockExtension(client));
  Object.assign(client.upload, getUploadExtension(client));
}

declare module '@cardstack/di' {
  interface KnownServices {
    'prisma-manager': PrismaManager;
  }
}
