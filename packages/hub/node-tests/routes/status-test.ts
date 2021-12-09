import { registry, setupHub } from '../helpers/server';

let stubWeb3Available = true;

let subgraphBlockNumber = 19492428;

class StubSubgraph {
  async getMeta() {
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
    return {
      eth: {
        getBlockNumber: async () => 19492430,
      },
    };
  }
}

// eslint-disable-next-line mocha/no-exclusive-tests
describe.only('GET /api/status', function () {
  this.beforeEach(function () {
    registry(this).register('subgraph', StubSubgraph);
    registry(this).register('web3-http', StubWeb3);
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
            rpcBlockNumber: 19492430,
            status: 'healthy',
            subgraphBlockNumber: 19492428,
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
            rpcBlockNumber: 19492430,
            status: 'degraded',
            subgraphBlockNumber: 19492419,
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });
});
