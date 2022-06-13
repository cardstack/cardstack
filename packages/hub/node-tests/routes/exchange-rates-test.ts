import { CryptoCompareFailureResponse, CryptoCompareSuccessResponse } from '../../services/exchange-rates';
import config from 'config';
import { setupHub, registry } from '../helpers/server';
import type Mocha from 'mocha';
import { Clock } from '../../services/clock';

const allowedDomains = config.get('exchangeRates.allowedDomains');
function isValidAllowedDomainConfig(object: unknown): object is string[] {
  return Array.isArray(object) && object.every((v) => typeof v === 'string') && object.length > 0;
}
if (!isValidAllowedDomainConfig(allowedDomains)) {
  throw new Error('Exchange rate allowed domain config is invalid');
}
const allowedDomain = allowedDomains[0];

class StubAuthenticationUtils {
  validateAuthToken(encryptedAuthToken: string) {
    return handleValidateAuthToken(encryptedAuthToken);
  }
}

let handleValidateAuthToken = function (_encryptedAuthToken: string) {
  return '';
};

let mockCryptoCompareExchangeRatesResponse = {
  BTC: {
    USD: 191,
  },
};

function stubCryptoCompareExchangeRates(context: Mocha.Suite) {
  let fetchExchangeRates: (
    ...args: any
  ) => Promise<CryptoCompareSuccessResponse | CryptoCompareFailureResponse | undefined> = function () {
    return Promise.resolve(mockCryptoCompareExchangeRatesResponse);
  };

  class StubExchangeRatesService {
    fetchExchangeRates() {
      return fetchExchangeRates(...arguments);
    }
  }
  context.beforeEach(function () {
    registry(this).register('exchange-rates', StubExchangeRatesService);
  });

  return {
    setFetchExchangeRates(
      func: () => Promise<CryptoCompareSuccessResponse | CryptoCompareFailureResponse | undefined>
    ) {
      fetchExchangeRates = func;
    },
  };
}

// ≈2022-04-20
let fakeTime = 1650440847689;

class FrozenClock extends Clock {
  now() {
    return fakeTime;
  }
}

describe('GET /api/exchange-rates', function () {
  this.beforeEach(function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);
    registry(this).register('clock', FrozenClock);
  });

  let { setFetchExchangeRates } = stubCryptoCompareExchangeRates(this);
  let { getContainer, request } = setupHub(this);

  it('does not fetch exchange rates for an incorrect origin', async function () {
    await request()
      .get(`/api/exchange-rates?from=BTC&to=USD`)
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

  it('does not fetch exchange rates if no origin and auth token', async function () {
    await request()
      .get(`/api/exchange-rates?from=BTC&to=USD`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
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
      .get(`/api/exchange-rates?from=BTC&to=USD&date=2022-04-06`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .set('Origin', allowedDomain)
      .expect(200)
      .expect({
        data: {
          type: 'exchange-rates',
          attributes: {
            base: 'BTC',
            rates: {
              USD: 191,
            },
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('defaults to the current date if none is specified', async function () {
    let fetchArgs: never[] = [];

    setFetchExchangeRates(async function (...args: any) {
      fetchArgs = args;

      return mockCryptoCompareExchangeRatesResponse;
    });

    await request()
      .get(`/api/exchange-rates?from=BTC&to=USD`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .set('Origin', allowedDomain)
      .expect(200)
      .expect({
        data: {
          type: 'exchange-rates',
          attributes: {
            base: 'BTC',
            rates: {
              USD: 191,
            },
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');

    expect(fetchArgs[2]).to.equal((await getContainer().lookup('clock')).dateStringNow());
  });

  it('rejects a date in the future', async function () {
    await request()
      .get(`/api/exchange-rates?from=BTC&to=USD&date=2222-04-06`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .set('Origin', allowedDomain)
      .expect(400)
      .expect({
        errors: [
          {
            status: '400',
            title: 'Bad Request',
            detail: 'date cannot be in the future',
            pointer: {
              parameter: 'date',
            },
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('allows an alternate exchange source', async function () {
    let fetchArgs: never[] = [];

    setFetchExchangeRates(async function (...args: any) {
      fetchArgs = args;

      return mockCryptoCompareExchangeRatesResponse;
    });

    await request()
      .get(`/api/exchange-rates?from=BTC&to=USD&e=something`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .set('Origin', allowedDomain)
      .expect(200);

    expect(fetchArgs[3]).to.equal('something');
  });

  it('fetches exchange rates with a valid auth token but no origin', async function () {
    let stubUserAddress = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';
    handleValidateAuthToken = (encryptedString: string) => {
      expect(encryptedString).to.equal('abc123--def456--ghi789');
      return stubUserAddress;
    };

    await request()
      .get(`/api/exchange-rates?from=BTC&to=USD&date=2022-04-06`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .expect(200)
      .expect({
        data: {
          type: 'exchange-rates',
          attributes: {
            base: 'BTC',
            rates: {
              USD: 191,
            },
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('Returns 400 when mandatory query parameters are missing', async function () {
    await request()
      .get(`/api/exchange-rates?to=USD`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .set('Origin', allowedDomain)
      .expect(400)
      .expect({
        errors: [
          {
            status: '400',
            title: 'Bad Request',
            detail: 'Missing required parameter: from',
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');

    await request()
      .get(`/api/exchange-rates?from=USD`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .set('Origin', allowedDomain)
      .expect(400)
      .expect({
        errors: [
          {
            status: '400',
            title: 'Bad Request',
            detail: 'Missing required parameter: to',
          },
        ],
      });

    await request()
      .get(`/api/exchange-rates`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .set('Origin', allowedDomain)
      .expect(400)
      .expect({
        errors: [
          {
            status: '400',
            title: 'Bad Request',
            detail: 'Missing required parameters: from, to',
          },
        ],
      });
  });

  it('Returns 502 for falsey result being fetched', async function () {
    setFetchExchangeRates(async function () {
      return undefined;
    });

    await request()
      .get(`/api/exchange-rates?from=BTC&to=USD`)
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

  it('Returns 502 for failure result from CryptoCompare', async function () {
    let errorResponse = {
      Response: 'Error',
      Message: 'readable info about the error',
      HasWarning: false,
      Type: 2,
      RateLimit: {},
      Data: {},
      ParamWithError: 'tsyms',
    };

    setFetchExchangeRates(async function () {
      return errorResponse;
    });

    await request()
      .get(`/api/exchange-rates?from=BTC&to=USD`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .set('Origin', allowedDomain)
      .expect(502)
      .expect({
        errors: [
          {
            status: '502',
            title: 'Bad Gateway',
            meta: errorResponse,
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
      .get(`/api/exchange-rates?from=BTC&to=USD`)
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .set('Origin', allowedDomain)
      .expect(500);
  });
});
