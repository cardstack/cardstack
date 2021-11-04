import { FixerFailureResponse, FixerSuccessResponse } from '../../services/exchange-rates';
import config from 'config';
import { setupHub, registry } from '../helpers/server';
import type Mocha from 'mocha';

const allowedDomains = config.get('exchangeRates.allowedDomains');
function isValidAllowedDomainConfig(object: unknown): object is string[] {
  return Array.isArray(object) && object.every((v) => typeof v === 'string') && object.length > 0;
}
if (!isValidAllowedDomainConfig(allowedDomains)) {
  throw new Error('Exchange rate allowed domain config is invalid');
}
const allowedDomain = allowedDomains[0];

const mockExchangeRatesResponse = {
  success: true,
  timestamp: Math.floor(Date.now() / 1000),
  date: '2021-09-30',
  base: 'USD',
  rates: {
    GBP: 1,
    CAD: 3,
  },
} as FixerSuccessResponse;

function stubExchangeRates(context: Mocha.Suite) {
  let fetchExchangeRates: () => Promise<FixerSuccessResponse | FixerFailureResponse | undefined> = function () {
    return Promise.resolve(mockExchangeRatesResponse);
  };

  class StubExchangeRatesService {
    fetchExchangeRates() {
      return fetchExchangeRates();
    }
  }
  context.beforeEach(function () {
    registry(this).register('exchange-rates', StubExchangeRatesService);
  });

  return {
    setFetchExchangeRates(func: () => Promise<FixerSuccessResponse | FixerFailureResponse | undefined>) {
      fetchExchangeRates = func;
    },
  };
}

describe('GET /api/exchange-rates', function () {
  let { setFetchExchangeRates } = stubExchangeRates(this);
  let { request } = setupHub(this);

  it('does not fetch exchange rates for an incorrect origin', async function () {
    await request()
      .get(`/api/exchange-rates`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .set('Origin', 'https://google.com')
      .expect(403)
      .expect({
        errors: [
          {
            status: '403',
            title: 'Not allowed',
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('fetches exchange rates for an accepted origin', async function () {
    await request()
      .get(`/api/exchange-rates`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .set('Origin', allowedDomain)
      .expect(200)
      .expect({
        data: {
          type: 'exchange-rates',
          attributes: {
            base: mockExchangeRatesResponse.base,
            rates: mockExchangeRatesResponse.rates,
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('Returns 502 for falsey result being fetched', async function () {
    setFetchExchangeRates(async function () {
      return undefined;
    });

    await request()
      .get(`/api/exchange-rates`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .set('Origin', allowedDomain)
      .expect(502)
      .expect({
        errors: [
          {
            status: '502',
            title: 'Bad Gateway',
            detail: 'Failed to fetch exchange rates for unknown reason',
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('Returns 502 for failure result from Fixer', async function () {
    setFetchExchangeRates(async function () {
      return {
        success: false,
        error: {
          code: -1,
          info: 'readable info about the error',
        },
      };
    });

    await request()
      .get(`/api/exchange-rates`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .set('Origin', allowedDomain)
      .expect(502)
      .expect({
        errors: [
          {
            status: '502',
            title: 'Bad Gateway',
            detail: '-1: readable info about the error',
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('Allows errors from the exchange rate service through', async function () {
    setFetchExchangeRates(async function () {
      let err = new Error('An error that might occur in caching or fetching');
      (err as any).intentionalTestError = true;
      throw err;
    });
    await request()
      .get(`/api/exchange-rates`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .set('Origin', allowedDomain)
      .expect(500);
  });
});
