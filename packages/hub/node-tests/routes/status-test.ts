import { registry, setupHub } from '../helpers/server';
import { setupSentry, waitForSentryReport } from '../helpers/sentry';

let stubWeb3Available = true;

let subgraphBlockNumber = 19492428;
let throwSubgraphError = false;
let throwWeb3Error = false;
let returnExchangeRatesError = false;
let throwExchangeRatesError = false;
let exchangeRatesLastFetched = Math.floor(Number(new Date()) / 1000);

class StubSubgraph {
  async getMeta() {
    if (throwSubgraphError) {
      throw new Error('Mock subgraph error');
    }

    return {
      data: {
        _meta: {
          block: {
            number: subgraphBlockNumber,
          },
          hasIndexingErrors: false,
        },
      },
    };
  }
}

class StubWeb3 {
  isAvailable() {
    return Promise.resolve(stubWeb3Available);
  }
  getInstance() {
    if (throwWeb3Error) {
      throw new Error('Mock Web3 error');
    }

    return {
      eth: {
        getBlockNumber: async () => 19492430,
      },
    };
  }
}

class StubExchangeRates {
  lastFetched = exchangeRatesLastFetched;
  async fetchCryptoCompareExchangeRates() {
    if (throwExchangeRatesError) {
      throw new Error('Mock exchange rates error');
    } else if (returnExchangeRatesError) {
      return {
        Response: 'Error',
        Message: 'Kucoin market does not exist for this coin pair (EUR-GBP)',
        HasWarning: false,
        Type: 2,
        RateLimit: {},
        Data: {},
        ParamWithError: 'e',
      };
    }

    return {
      USD: {
        EUR: 0.9,
      },
    };
  }
}

describe('GET /api/status', function () {
  setupSentry(this);

  this.beforeEach(function () {
    registry(this).register('exchange-rates', StubExchangeRates);
    registry(this).register('subgraph', StubSubgraph);
    registry(this).register('web3-http', StubWeb3);

    throwSubgraphError = false;
    throwWeb3Error = false;
    returnExchangeRatesError = false;
    throwExchangeRatesError = false;
    subgraphBlockNumber = 19492428;
    stubWeb3Available = true;
  });

  let { request } = setupHub(this);

  it('reports status information', async function () {
    await request()
      .get('/api/status')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: {
          type: 'status',
          attributes: {
            subgraph: {
              rpcBlockNumber: 19492430,
              status: 'operational',
              subgraphBlockNumber: 19492428,
            },
            exchangeRates: {
              status: 'operational',
            },
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('reports degraded status when the subgraph is behind', async function () {
    subgraphBlockNumber = 19492419;

    await request()
      .get('/api/status')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: {
          type: 'status',
          attributes: {
            subgraph: {
              details: 'Experiencing slow service',
              rpcBlockNumber: 19492430,
              status: 'degraded',
              subgraphBlockNumber: 19492419,
            },
            exchangeRates: {
              status: 'operational',
            },
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('reports degraded status when the subgraph throws an error', async function () {
    throwSubgraphError = true;

    await request()
      .get('/api/status')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: {
          type: 'status',
          attributes: {
            subgraph: {
              details: 'Error checking status',
              rpcBlockNumber: 19492430,
              status: 'unknown',
              subgraphBlockNumber: null,
            },
            exchangeRates: {
              status: 'operational',
            },
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');

    let sentryReport = await waitForSentryReport();

    expect(sentryReport.tags).to.deep.equal({
      action: 'status-route',
    });

    expect(sentryReport.error?.message).to.equal('Mock subgraph error');
  });

  it('reports degraded status when web3 throws an error', async function () {
    throwWeb3Error = true;

    await request()
      .get('/api/status')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: {
          type: 'status',
          attributes: {
            subgraph: {
              details: 'Error checking status',
              rpcBlockNumber: null,
              status: 'unknown',
              subgraphBlockNumber: 19492428,
            },
            exchangeRates: {
              status: 'operational',
            },
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');

    let sentryReport = await waitForSentryReport();

    expect(sentryReport.tags).to.deep.equal({
      action: 'status-route',
    });

    expect(sentryReport.error?.message).to.equal('Mock Web3 error');
  });

  it('reports unknown status when exchangeRates service throws an error', async function () {
    throwExchangeRatesError = true;

    await request()
      .get('/api/status')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: {
          type: 'status',
          attributes: {
            subgraph: {
              rpcBlockNumber: 19492430,
              status: 'operational',
              subgraphBlockNumber: 19492428,
            },
            exchangeRates: {
              status: 'unknown',
            },
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');

    let sentryReport = await waitForSentryReport();

    expect(sentryReport.tags).to.deep.equal({
      action: 'status-route',
    });

    expect(sentryReport.error?.message).to.equal('Mock exchange rates error');
  });

  it('reports unknown status when exchangeRates service returns an error', async function () {
    returnExchangeRatesError = true;

    await request()
      .get('/api/status')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: {
          type: 'status',
          attributes: {
            subgraph: {
              rpcBlockNumber: 19492430,
              status: 'operational',
              subgraphBlockNumber: 19492428,
            },
            exchangeRates: {
              status: 'unknown',
            },
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');

    let sentryReport = await waitForSentryReport();

    expect(sentryReport.tags).to.deep.equal({
      action: 'status-route',
    });

    expect(sentryReport.error?.message).to.equal('Kucoin market does not exist for this coin pair (EUR-GBP)');
  });
});
