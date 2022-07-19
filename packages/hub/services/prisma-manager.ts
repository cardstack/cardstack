import { Prisma, PrismaClient } from '@prisma/client';
import config from 'config';
import { PrismaTestingHelper } from '@chax-at/transactional-prisma-testing';
import { CryptoCompareConversionBlock } from './exchange-rates';

type PushNotificationRegistrationGetter = Prisma.PushNotificationRegistrationDelegate<any>;

interface ExtendedPushNotificationRegistrations extends PushNotificationRegistrationGetter {
  upsertByOwnerAndPushClient({
    id,
    ownerAddress,
    pushClientId,
    disabledAt,
  }: {
    id: string;
    ownerAddress: string;
    pushClientId: string;
    disabledAt: Date | null;
  }): ReturnType<PushNotificationRegistrationGetter['upsert']>;
}

type ExchangeRateGetter = Prisma.ExchangeRateDelegate<any>;

interface ExtendedExchangeRate extends ExchangeRateGetter {
  select(from: string, to: string[], date: string, exchange: string): Promise<CryptoCompareConversionBlock | null>;
}

export interface ExtendedPrismaClient extends PrismaClient {
  exchangeRate: ExtendedExchangeRate;
  pushNotificationRegistration: ExtendedPushNotificationRegistrations;
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

      this.addConvenienceFunctions(client);

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

  private addConvenienceFunctions(client: PrismaClient) {
    Object.assign(client.exchangeRate, {
      async select(
        from: string,
        to: string[],
        date: string,
        exchange: string
      ): Promise<CryptoCompareConversionBlock | null> {
        let rows = await client.exchangeRate.findMany({
          select: { toSymbol: true, rate: true },
          where: { fromSymbol: from, toSymbol: { in: to }, date: new Date(Date.parse(date)), exchange },
        });

        if (rows.length) {
          return rows.reduce((rates, row) => {
            rates[row.toSymbol] = row.rate.toNumber();
            return rates;
          }, {} as any);
        } else {
          return null;
        }
      },
    });

    Object.assign(client.pushNotificationRegistration, {
      upsertByOwnerAndPushClient({
        id,
        ownerAddress,
        pushClientId,
        disabledAt = null,
      }: {
        id: string;
        ownerAddress: string;
        pushClientId: string;
        disabledAt: Date | null;
      }) {
        return client.pushNotificationRegistration.upsert(
          Prisma.validator<Prisma.PushNotificationRegistrationUpsertArgs>()({
            where: {
              ownerAddress_pushClientId: {
                ownerAddress,
                pushClientId,
              },
            },
            create: {
              id: id,
              ownerAddress,
              pushClientId,
              disabledAt,
            },
            update: {
              disabledAt,
            },
          })
        );
      },
    });
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'prisma-manager': PrismaManager;
  }
}
