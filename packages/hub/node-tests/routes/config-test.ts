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
              network: 'sokol',
              evmFullNodeUrl: 'https://humorme.test/abc123/',
            },
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });
});
