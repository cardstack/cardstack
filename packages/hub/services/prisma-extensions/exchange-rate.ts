import { Prisma, PrismaClient } from '@prisma/client';
import { CryptoCompareConversionBlock } from '../exchange-rates';

type ExchangeRateGetter = Prisma.ExchangeRateDelegate<any>;

interface ExchangeRateExtensions {
  select({
    from,
    to,
    date,
    exchange,
  }: {
    from: string;
    to: string[];
    date: string;
    exchange: string;
  }): Promise<CryptoCompareConversionBlock | null>;
}

export interface ExtendedExchangeRate extends ExchangeRateGetter, ExchangeRateExtensions {}

export function getExchangeRateExtension(client: PrismaClient) {
  return {
    async select({
      from,
      to,
      date,
      exchange,
    }: {
      from: string;
      to: string[];
      date: string;
      exchange: string;
    }): Promise<CryptoCompareConversionBlock | null> {
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
  };
}
