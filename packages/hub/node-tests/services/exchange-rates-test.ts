import ExchangeRatesService, { CryptoCompareSuccessResponse } from '../../services/exchange-rates';

import { setupHub } from '../helpers/server';

interface CryptoCompareSuccessResponsesByExchange {
  [exchange: string]: CryptoCompareSuccessResponsesByDate;
}

interface CryptoCompareSuccessResponsesByDate {
  [date: string]: CryptoCompareSuccessResponse;
}

describe('ExchangeRatesService', function () {
  let { getContainer } = setupHub(this);
  let subject: ExchangeRatesService;

  this.beforeEach(async function () {
    let mockResponses = {
      CCCAGG: {
        1654041600: {
          BTC: {
            USD: 432.18,
          },
        },
      },
      kucoin: {
        1654041600: {
          CARD: {
            USDT: 0.002059,
          },
        },
      },
    } as CryptoCompareSuccessResponsesByExchange;

    class PatchedExchangeRatesService extends ExchangeRatesService {
      async requestExchangeRatesFromCryptoCompare(
        from: string,
        to: string,
        dateString: string,
        exchange = 'CCCAGG'
      ): Promise<CryptoCompareSuccessResponse> {
        let date = Date.parse(dateString) / 1000;
        let exchangeRate = mockResponses[exchange][date][from][to];

        if (!exchangeRate) {
          throw new Error(`No exchange rate found for ${from} to ${to}`);
        }

        return {
          [from]: {
            [to]: exchangeRate,
          },
        };
      }
    }

    subject = await getContainer().instantiate(PatchedExchangeRatesService);
  });

  it('fetches the rates when they are not cached and caches them', async function () {
    let exchangeRates = await getContainer().lookup('exchange-rates', { type: 'query' });
    await exchangeRates.insert('BTC', 'USD', 1919, '2022-05-01', 'CCCAGG');

    let result = await subject.fetchCryptoCompareExchangeRates('BTC', 'USD', '2022-06-01');

    // TODO should these be strings or numbers?
    expect(result).deep.equal({ BTC: { USD: 432.18 } });

    let cachedValue = await exchangeRates.select('BTC', 'USD', '2022-06-01');
    expect(cachedValue).equal(432.18);
  });

  it('returns the cached rates when they exist', async function () {
    let exchangeRates = await getContainer().lookup('exchange-rates', { type: 'query' });
    await exchangeRates.insert('BTC', 'USD', 1919, '2022-06-01', 'CCCAGG');

    let result = await subject.fetchCryptoCompareExchangeRates('BTC', 'USD', '2022-06-01');

    expect(result).deep.equal({
      BTC: {
        USD: 1919,
      },
    });
  });

  it('fetches the rates from another exchange when they are not cached and caches them', async function () {
    let exchangeRates = await getContainer().lookup('exchange-rates', { type: 'query' });
    await exchangeRates.insert('CARD', 'USDT', 1919, '2022-05-01', 'kucoin');
    await exchangeRates.insert('CARD', 'USDT', 1870, '2022-06-01', 'CCCAGG');

    let result = await subject.fetchCryptoCompareExchangeRates('CARD', 'USDT', '2022-06-01', 'kucoin');

    expect(result).deep.equal({ CARD: { USDT: 0.002059 } });

    let cachedValue = await exchangeRates.select('CARD', 'USDT', '2022-06-01', 'kucoin');
    expect(cachedValue).equal(0.002059);
  });
});
