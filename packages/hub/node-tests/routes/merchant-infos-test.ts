import { Registry } from '../../di/dependency-injection';
import { Job, TaskSpec } from 'graphile-worker';
import { setupServer } from '../helpers/server';

const stubNonce = 'abc:123';
let stubAuthToken = 'def--456';
let stubTimestamp = process.hrtime.bigint();

class StubAuthenticationUtils {
  generateNonce() {
    return stubNonce;
  }
  buildAuthToken() {
    return stubAuthToken;
  }
  extractVerifiedTimestamp(_nonce: string) {
    return stubTimestamp;
  }

  validateAuthToken(encryptedAuthToken: string) {
    return handleValidateAuthToken(encryptedAuthToken);
  }
}

let lastAddedJobIdentifier: string | undefined;
let lastAddedJobPayload: any | undefined;

class StubWorkerClient {
  async addJob(identifier: string, payload?: any, _spec?: TaskSpec): Promise<Job> {
    lastAddedJobIdentifier = identifier;
    lastAddedJobPayload = payload;
    return Promise.resolve({} as Job);
  }
}

let stubUserAddress = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';
function handleValidateAuthToken(encryptedString: string) {
  expect(encryptedString).to.equal('abc123--def456--ghi789');
  return stubUserAddress;
}

describe('POST /api/merchant-infos', function () {
  let { request } = setupServer(this, {
    registryCallback(registry: Registry) {
      registry.register('authentication-utils', StubAuthenticationUtils);
      registry.register('worker-client', StubWorkerClient);
    },
  });

  this.afterEach(async function () {
    lastAddedJobIdentifier = undefined;
    lastAddedJobPayload = undefined;
  });

  it('persists merchant info', async function () {
    const payload = {
      data: {
        type: 'merchant-infos',
        attributes: {
          name: 'Satoshi Nakamoto',
          slug: 'satoshi',
          color: 'ff0000',
          'text-color': 'ffffff',
          'owner-address': '0x00000000000',
        },
      },
    };

    let resourceId = null;

    await request()
      .post('/api/merchant-infos')
      .send(payload)
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(201)
      .expect(function (res) {
        resourceId = res.body.data.id;
        res.body.data.id = 'the-id';
        res.body.data.attributes.did = 'the-did';
      })
      .expect({
        data: {
          type: 'merchant-infos',
          id: 'the-id',
          attributes: {
            name: 'Satoshi Nakamoto',
            slug: 'satoshi',
            did: 'the-did',
            color: 'ff0000',
            'text-color': 'ffffff',
            'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');

    expect(lastAddedJobIdentifier).to.equal('persist-off-chain-merchant-info');
    expect(lastAddedJobPayload).to.deep.equal({ id: resourceId });
  });

  it('returns 401 without bearer token', async function () {
    await request()
      .post('/api/merchant-infos')
      .send({})
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(401)
      .expect({
        errors: [
          {
            status: '401',
            title: 'No valid auth token',
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('validates slug against invalid or lowercase characters', async function () {
    const payload = {
      data: {
        type: 'merchant-infos',
        attributes: {
          name: 'Satoshi Nakamoto 2',
          slug: 'sat-oshi',
          color: 'ff0000',
          'text-color': 'ffffff',
          'owner-address': '0x00000000000',
        },
      },
    };

    await request()
      .post('/api/merchant-infos')
      .send(payload)
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect({
        status: '422',
        title: 'Invalid merchant slug',
        detail: 'The Merchant ID can only contain lowercase letters or numbers, no special characters',
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('validates slug for length', async function () {
    const payload = {
      data: {
        type: 'merchant-infos',
        attributes: {
          name: 'Satoshi Nakamoto 2',
          slug: 'satoshisatoshisatoshisatoshisatoshisatoshisatoshi11',
          color: 'ff0000',
          'text-color': 'ffffff',
          'owner-address': '0x00000000000',
        },
      },
    };

    await request()
      .post('/api/merchant-infos')
      .send(payload)
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect({
        status: '422',
        title: 'Invalid merchant slug',
        detail: 'The Merchant ID cannot be more than 50 characters long. It is currently 51 characters long',
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('validates slug for uniqueness', async function () {
    const payload = {
      data: {
        type: 'merchant-infos',
        attributes: {
          name: 'Satoshi Nakamoto',
          slug: 'satoshi',
          color: 'ff0000',
          'text-color': 'ffffff',
          'owner-address': '0x00000000000',
        },
      },
    };

    const payload2 = {
      data: {
        type: 'merchant-infos',
        attributes: {
          name: 'Satoshi Nakamoto 2',
          slug: 'satoshi',
          color: 'ff0000',
          'text-color': 'ffffff',
          'owner-address': '0x00000000000',
        },
      },
    };

    await request()
      .post('/api/merchant-infos')
      .send(payload)
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(201);

    await request()
      .post('/api/merchant-infos')
      .send(payload2)
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect({
        status: '422',
        title: 'Invalid merchant slug',
        detail: 'Merchant slug already exists',
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });
});

describe('GET /api/merchant-infos/validate-slug/:slug', function () {
  let { request } = setupServer(this, {
    registryCallback(registry: Registry) {
      registry.register('authentication-utils', StubAuthenticationUtils);
      registry.register('worker-client', StubWorkerClient);
    },
  });

  this.afterEach(async function () {
    lastAddedJobIdentifier = undefined;
    lastAddedJobPayload = undefined;
  });

  it('returns 401 without bearer token', async function () {
    const slug = 'slug';
    await request()
      .get(`/api/merchant-infos/validate-slug/${slug}`)
      .set('Content-Type', 'application/vnd.api+json')
      .expect(401)
      .expect({
        errors: [
          {
            status: '401',
            title: 'No valid auth token',
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('validates slug against invalid or lowercase characters', async function () {
    const slug1 = 'sat-oshi';
    await request()
      .get(`/api/merchant-infos/validate-slug/${slug1}`)
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        slugAvailable: false,
        detail: 'The Merchant ID can only contain lowercase letters or numbers, no special characters',
      })
      .expect('Content-Type', 'application/vnd.api+json');

    const slug2 = 'sat oshi';
    await request()
      .get(`/api/merchant-infos/validate-slug/${slug2}`)
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        slugAvailable: false,
        detail: 'The Merchant ID can only contain lowercase letters or numbers, no special characters',
      })
      .expect('Content-Type', 'application/vnd.api+json');

    const slug3 = 'Satoshi';
    await request()
      .get(`/api/merchant-infos/validate-slug/${slug3}`)
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        slugAvailable: false,
        detail: 'The Merchant ID can only contain lowercase letters or numbers, no special characters',
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('validates slug for length', async function () {
    const slug = 'satoshisatoshisatoshisatoshisatoshisatoshisatoshi11';
    await request()
      .get(`/api/merchant-infos/validate-slug/${slug}`)
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        slugAvailable: false,
        detail: 'The Merchant ID cannot be more than 50 characters long. It is currently 51 characters long',
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('validates slug for uniqueness', async function () {
    const payload = {
      data: {
        type: 'merchant-infos',
        attributes: {
          name: 'Mandello',
          slug: 'mandello1',
          color: 'ff5050',
          'text-color': 'ffffff',
          'owner-address': '0x00000000000',
        },
      },
    };

    await request()
      .post('/api/merchant-infos')
      .send(payload)
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(201);

    const slug1 = 'mandello1';
    await request()
      .get(`/api/merchant-infos/validate-slug/${slug1}`)
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        slugAvailable: false,
        detail: 'Merchant slug already exists',
      })
      .expect('Content-Type', 'application/vnd.api+json');

    const slug2 = 'mandello2';
    await request()
      .get(`/api/merchant-infos/validate-slug/${slug2}`)
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        slugAvailable: true,
        detail: 'Merchant slug is available',
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });
});
