import ExchangeRatesService, {
  CryptoCompareFailureResponse,
  CryptoCompareSuccessResponse,
} from '../../services/exchange-rates';

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

  let mockErrorResponse = {
    Response: 'Error',
    Message: 'Kucoin market does not exist for this coin pair (EUR-GBP)',
    HasWarning: false,
    Type: 2,
    RateLimit: {},
    Data: {},
    ParamWithError: 'e',
  };

  this.beforeEach(async function () {
    let mockResponses = {
      CCCAGG: {
        1654041600: {
          BTC: {
            CAD: 2010,
            GBP: 2,
            USD: 432.18,
          },
        },
        1654214400: {
          XYZ: {
            A00: 1,
            B00: 2,
            C00: 3,
            D00: 4,
            E00: 5,
            F00: 6,
            G00: 7,
            H00: 8,
            I00: 9,
            J00: 10,
            K00: 11,
            L00: 12,
            M00: 13,
            N00: 14,
            O00: 15,
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
        tos: string[],
        dateString: string,
        exchange = 'CCCAGG'
      ): Promise<CryptoCompareSuccessResponse | CryptoCompareFailureResponse> {
        let date = Date.parse(dateString) / 1000;

        if (from === 'EUR' && tos[0] === 'GBP' && exchange == 'kucoin') {
          return mockErrorResponse;
        }

        if (tos.join(',').length > 30) {
          return {
            Response: 'Error',
            Message: 'tsyms param is invalid. (tsyms length is higher than maxlength: 30)',
            HasWarning: false,
            Type: 2,
            RateLimit: {},
            Data: {},
            ParamWithError: 'tsyms',
          };
        }

        let toAndRates = tos.map((to) => {
          let exchangeRate = mockResponses[exchange]?.[date]?.[from]?.[to];

          if (!exchangeRate) {
            throw new Error(`No exchange rate found for ${from} to ${to}`);
          }

          return [to, exchangeRate];
        });

        return {
          [from]: Object.fromEntries(toAndRates),
        };
      }
    }

    subject = await getContainer().instantiate(PatchedExchangeRatesService);
  });

  it('fetches the rates when they are not cached and caches them', async function () {
    let exchangeRates = await getContainer().lookup('exchange-rates', { type: 'query' });
    await exchangeRates.insert('BTC', 'USD', 1919, '2022-05-01', 'CCCAGG');

    let result = await subject.fetchExchangeRates('BTC', ['USD'], '2022-06-01');

    // TODO should these be strings or numbers?
    expect(result).deep.equal({ BTC: { USD: 432.18 } });

    let cachedValue = await exchangeRates.select('BTC', ['USD'], '2022-06-01');
    expect(cachedValue).deep.equal({ USD: 432.18 });
  });

  it('can fetch some rates and use some cached rates', async function () {
    let exchangeRates = await getContainer().lookup('exchange-rates', { type: 'query' });
    await exchangeRates.insert('BTC', 'AUD', 2.1, '2022-06-01', 'CCCAGG');
    await exchangeRates.insert('BTC', 'USD', 1919, '2022-06-01', 'CCCAGG');

    let result = await subject.fetchExchangeRates('BTC', ['AUD', 'GBP', 'USD', 'CAD'], '2022-06-01');

    expect(result).deep.equal({ BTC: { AUD: 2.1, CAD: 2010, GBP: 2, USD: 1919 } });

    let cachedValue = await exchangeRates.select('BTC', ['CAD', 'GBP'], '2022-06-01');
    expect(cachedValue).deep.equal({ CAD: 2010, GBP: 2 });
  });

  it('can chunk fetches to handle the limit on tsyms', async function () {
    let result = await subject.fetchExchangeRates(
      'XYZ',
      ['A00', 'B00', 'C00', 'D00', 'E00', 'F00', 'G00', 'H00', 'I00', 'J00', 'K00', 'L00', 'M00', 'N00', 'O00'],
      '2022-06-03'
    );

    expect(result).deep.equal({
      XYZ: {
        A00: 1,
        B00: 2,
        C00: 3,
        D00: 4,
        E00: 5,
        F00: 6,
        G00: 7,
        H00: 8,
        I00: 9,
        J00: 10,
        K00: 11,
        L00: 12,
        M00: 13,
        N00: 14,
        O00: 15,
      },
    });
  });

  it('returns the cached rates when they exist', async function () {
    let exchangeRates = await getContainer().lookup('exchange-rates', { type: 'query' });
    await exchangeRates.insert('BTC', 'USD', 1919, '2022-06-01', 'CCCAGG');

    let result = await subject.fetchExchangeRates('BTC', ['USD'], '2022-06-01');

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

    let result = await subject.fetchExchangeRates('CARD', ['USDT'], '2022-06-01', 'kucoin');

    expect(result).deep.equal({ CARD: { USDT: 0.002059 } });

    let cachedValue = await exchangeRates.select('CARD', ['USDT'], '2022-06-01', 'kucoin');
    expect(cachedValue).deep.equal({ USDT: 0.002059 });
  });

  it('passes on error responses', async function () {
    let result = await subject.fetchExchangeRates('EUR', ['GBP'], '2022-06-01', 'kucoin');

    expect(result).deep.equal(mockErrorResponse);
  });
});
