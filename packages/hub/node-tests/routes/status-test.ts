import { registry, setupHub } from '../helpers/server';
import { fetchSentryReport, setupSentry } from '../helpers/sentry';

let stubWeb3Available = true;

let subgraphBlockNumber = 19492428;
let throwSubgraphError = false;
let throwWeb3Error = false;
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
  async fetchExchangeRates() {
    if (throwExchangeRatesError) {
      throw new Error('Mock exchange rates error');
    }

    return {
      success: true,
      timestamp: exchangeRatesLastFetched,
      base: 'USD',
      date: '2021-10-05',
      rates: {
        JPY: 4,
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
              lastFetched: exchangeRatesLastFetched,
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
              lastFetched: exchangeRatesLastFetched,
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
              lastFetched: exchangeRatesLastFetched,
            },
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');

    let sentryReport = await fetchSentryReport();

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
              lastFetched: exchangeRatesLastFetched,
            },
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');

    let sentryReport = await fetchSentryReport();

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
              lastFetched: exchangeRatesLastFetched,
            },
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');

    let sentryReport = await fetchSentryReport();

    expect(sentryReport.tags).to.deep.equal({
      action: 'status-route',
    });

    expect(sentryReport.error?.message).to.equal('Mock exchange rates error');
  });
});
