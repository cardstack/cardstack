import ExchangeRatesService, { FixerFailureResponse, FixerSuccessResponse } from '../../services/exchange-rates';

describe('ExchangeRatesService', function () {
  it('hits the cache if the cache is valid', async function () {
    let mockCachedValue: FixerSuccessResponse = {
      success: true,
      timestamp: Math.floor(Number(new Date()) / 1000),
      base: 'USD',
      date: '2021-10-05',
      rates: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        JPY: 4,
      },
    };

    class PatchedExchangeRatesService extends ExchangeRatesService {
      interval = 1000;
      cachedValue = mockCachedValue;

      async requestExchangeRatesFromFixer(): Promise<FixerSuccessResponse> {
        return {
          success: true,
          timestamp: Math.floor(Number(new Date()) / 1000),
          base: 'USD',
          date: '2021-10-02',
          rates: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            GBP: 4,
          },
        };
      }

      get cacheIsValid() {
        return true;
      }
    }

    let subject = new PatchedExchangeRatesService();
    let result = await subject.fetchExchangeRates();

    expect(result).deep.equal(mockCachedValue);
  });

  it('does not hit the cache if the cache is invalid', async function () {
    let freshFetches = 0;
    let mockCachedValue: FixerSuccessResponse = {
      success: true,
      timestamp: Math.floor(Number(new Date()) / 1000),
      base: 'USD',
      date: '2021-10-05',
      rates: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        JPY: 4,
      },
    };
    let mockFreshValue: FixerSuccessResponse = {
      success: true,
      timestamp: Math.floor(Number(new Date()) / 1000),
      base: 'USD',
      date: '2021-10-02',
      rates: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        GBP: 4,
      },
    };

    class PatchedExchangeRatesService extends ExchangeRatesService {
      interval = 1000;
      cachedValue = mockCachedValue;

      async requestExchangeRatesFromFixer(): Promise<FixerSuccessResponse> {
        freshFetches += 1;
        return mockFreshValue;
      }

      get cacheIsValid() {
        return false;
      }
    }

    let subject = new PatchedExchangeRatesService();
    let result = await subject.fetchExchangeRates();

    expect(freshFetches).equal(1);
    expect(result).deep.equal(mockFreshValue);
  });

  it('invalidates the cache if it has been too long since last fetch', async function () {
    let duration = 2000;
    let mockCachedValue: FixerSuccessResponse = {
      success: true,
      timestamp: Math.floor(Number(new Date()) / 1000),
      base: 'USD',
      date: '2021-10-05',
      rates: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        JPY: 4,
      },
    };
    class PatchedExchangeRatesService extends ExchangeRatesService {
      lastFetched = Number(new Date());
      cachedValue = mockCachedValue;
      interval = duration;

      async requestExchangeRatesFromFixer(): Promise<FixerSuccessResponse> {
        return {
          success: true,
          timestamp: Math.floor(Number(new Date()) / 1000),
          base: 'USD',
          date: '2021-10-02',
          rates: {
            // eslint-disable-next-line @typescript-eslint/naming-convention
            GBP: 4,
          },
        };
      }
    }

    let subject = new PatchedExchangeRatesService();
    expect(subject.cacheIsValid).equal(true);
    subject.lastFetched = Number(new Date()) - duration * 2;
    expect(subject.cacheIsValid).equal(false);
  });

  it('clears the cache after an error', async function () {
    let mockCachedValue: FixerSuccessResponse = {
      success: true,
      timestamp: Math.floor(Number(new Date()) / 1000),
      base: 'USD',
      date: '2021-10-05',
      rates: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        JPY: 4,
      },
    };

    class PatchedExchangeRatesService extends ExchangeRatesService {
      interval = 1000;
      cachedValue = mockCachedValue;

      async requestExchangeRatesFromFixer(): Promise<FixerSuccessResponse> {
        throw new Error('This error should clear the cache and reset last fetched timer');
      }
    }

    let subject = new PatchedExchangeRatesService();
    subject.lastFetched = Number(new Date());
    expect(subject.cacheIsValid).equal(true);
    subject.lastFetched = Number(new Date()) - 2000;
    await expect(subject.fetchExchangeRates()).rejectedWith(
      'This error should clear the cache and reset last fetched timer'
    );
    expect(subject.cachedValue).equal(undefined);
    expect(subject.lastFetched).equal(0);
  });

  it('returns a failure response from Fixer', async function () {
    let mockFailureResponse = {
      success: false,
      error: {
        code: -1,
        info: 'Some info about the error',
      },
    } as FixerFailureResponse;

    class PatchedExchangeRatesService extends ExchangeRatesService {
      interval = 1000;

      async requestExchangeRatesFromFixer(): Promise<FixerFailureResponse> {
        return mockFailureResponse;
      }
    }

    let subject = new PatchedExchangeRatesService();

    expect(await subject.fetchExchangeRates()).deep.equal(mockFailureResponse);
  });
});
