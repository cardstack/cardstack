import { setupHub } from '../helpers/server';

describe('GET /api/config', function () {
  let { request } = setupHub(this);

  it('returns config information', async function () {
    await request()
      .get('/api/config')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: {
          type: 'config',
          attributes: {
            web3: {
              ethereum: {
                rpcNodeHttpsUrl: 'https://goerli.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
                rpcNodeWssUrl: 'wss://ethereum.test/abc123/',
              },
              gnosis: {
                rpcNodeHttpsUrl: 'https://gnosis.test/abc123/',
                rpcNodeWssUrl: 'wss://gnosis.test/abc123/',
              },
              polygon: {
                rpcNodeHttpsUrl: 'https://polygon.test/abc123/',
                rpcNodeWssUrl: 'wss://polygon.test/abc123/',
              },
              layer1Network: 'kovan',
              layer1RpcNodeHttpsUrl: 'https://infuratest.test/abc123/',
              layer1RpcNodeWssUrl: 'wss://infuratest.test/ws/abc123/',
              layer2Network: 'sokol',
              layer2RpcNodeHttpsUrl: 'https://humorme.test/abc123/',
              layer2RpcNodeWssUrl: 'wss://humorme.test/abc123/',
              schedulerNetworks: ['goerli'],
            },
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });
});
