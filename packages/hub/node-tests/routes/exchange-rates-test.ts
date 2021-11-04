import ExchangeRatesService, { FixerFailureResponse, FixerSuccessResponse } from '../../services/exchange-rates';
import config from 'config';
import { setupHub } from '../helpers/server';

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

class StubExchangeRatesService {
  fetchExchangeRates() {
    return Promise.resolve(mockExchangeRatesResponse);
  }
}

describe('GET /api/exchange-rates', function () {
  let { request, getContainer } = setupHub(this, {
    additionalRegistrations: {
      'exchange-rates': StubExchangeRatesService,
    },
  });

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
    getContainer().register(
      'exchange-rates',
      class FalseyReturnExchangeRatesService extends ExchangeRatesService {
        async fetchExchangeRates() {
          return undefined;
        }
      }
    );

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
    await getContainer().register(
      'exchange-rates',
      class FailingExchangeRatesService extends ExchangeRatesService {
        async fetchExchangeRates(): Promise<FixerFailureResponse> {
          return {
            success: false,
            error: {
              code: -1,
              info: 'readable info about the error',
            },
          };
        }
      }
    );
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
    await getContainer().register(
      'exchange-rates',
      class CrashingExchangeRatesService extends ExchangeRatesService {
        async fetchExchangeRates(): Promise<FixerFailureResponse> {
          throw new Error('An error that might occur in caching or fetching');
        }
      }
    );
    await request()
      .get(`/api/exchange-rates`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .set('Origin', allowedDomain)
      .expect(500);
  });
});
