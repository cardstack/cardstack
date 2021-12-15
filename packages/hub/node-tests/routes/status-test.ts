import { registry, setupHub } from '../helpers/server';
import sentryTestkit from 'sentry-testkit';
import * as Sentry from '@sentry/node';
import waitFor from '../utils/wait-for';

const { testkit, sentryTransport } = sentryTestkit();

let stubWeb3Available = true;

let subgraphBlockNumber = 19492428;
let throwSubgraphError = false;
let throwWeb3Error = false;

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

describe('GET /api/status', function () {
  this.beforeEach(function () {
    Sentry.init({
      dsn: 'https://acacaeaccacacacabcaacdacdacadaca@sentry.io/000001',
      release: 'test',
      tracesSampleRate: 1,
      transport: sentryTransport,
    });

    testkit.reset();

    registry(this).register('subgraph', StubSubgraph);
    registry(this).register('web3-http', StubWeb3);

    throwSubgraphError = false;
    throwWeb3Error = false;
  });

  let { request } = setupHub(this);

  this.beforeEach(async function () {
    subgraphBlockNumber = 19492428;
    stubWeb3Available = true;
  });

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
              rpcBlockNumber: 19492430,
              status: 'degraded',
              subgraphBlockNumber: 19492419,
            },
          },
        },
        errors: [
          {
            id: 'subgraph',
            source: {
              pointer: '/data/attributes/subgraph/subgraphBlockNumber',
            },
          },
        ],
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
              rpcBlockNumber: 19492430,
              status: 'degraded',
              subgraphBlockNumber: null,
            },
          },
        },
        errors: [
          {
            id: 'subgraph',
            source: {
              service: 'subgraph',
            },
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');

    await waitFor(() => testkit.reports().length > 0);

    expect(testkit.reports()[0].tags).to.deep.equal({
      action: 'status-route',
    });

    expect(testkit.reports()[0].error?.message).to.equal('Mock subgraph error');
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
              rpcBlockNumber: null,
              status: 'degraded',
              subgraphBlockNumber: 19492428,
            },
          },
        },
        errors: [
          {
            id: 'subgraph',
            source: {
              service: 'web3-http',
            },
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');

    await waitFor(() => testkit.reports().length > 0);

    expect(testkit.reports()[0].tags).to.deep.equal({
      action: 'status-route',
    });

    expect(testkit.reports()[0].error?.message).to.equal('Mock Web3 error');
  });
});
