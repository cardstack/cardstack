import supertest, { Test } from 'supertest';
import { HubServer } from '../../main';
import { Registry } from '../../di/dependency-injection';
import ExchangeRatesService, { FixerFailureResponse, FixerSuccessResponse } from '../../services/exchange-rates';
import config from 'config';

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
  let server: HubServer;
  let request: supertest.SuperTest<Test>;

  this.afterEach(async function () {
    server?.teardown();
  });

  it('does not fetch exchange rates for an incorrect origin', async function () {
    server = await HubServer.create({
      registryCallback(registry: Registry) {
        registry.register('exchange-rates', StubExchangeRatesService);
      },
    });
    request = supertest(server.app.callback());
    await request
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
    server = await HubServer.create({
      registryCallback(registry: Registry) {
        registry.register('exchange-rates', StubExchangeRatesService);
      },
    });
    request = supertest(server.app.callback());
    await request
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
    class FalseyReturnExchangeRatesService extends ExchangeRatesService {
      async fetchExchangeRates() {
        return undefined;
      }
    }
    server = await HubServer.create({
      registryCallback(registry: Registry) {
        registry.register('exchange-rates', FalseyReturnExchangeRatesService);
      },
    });
    request = supertest(server.app.callback());
    await request
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
    server = await HubServer.create({
      registryCallback(registry: Registry) {
        registry.register('exchange-rates', FailingExchangeRatesService);
      },
    });
    request = supertest(server.app.callback());
    await request
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
    class CrashingExchangeRatesService extends ExchangeRatesService {
      async fetchExchangeRates(): Promise<FixerFailureResponse> {
        throw new Error('An error that might occur in caching or fetching');
      }
    }
    server = await HubServer.create({
      registryCallback(registry: Registry) {
        registry.register('exchange-rates', CrashingExchangeRatesService);
      },
    });
    request = supertest(server.app.callback());
    await request
      .get(`/api/exchange-rates`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .set('Origin', allowedDomain)
      .expect(500);
  });
});
