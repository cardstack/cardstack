import { Job, TaskSpec } from 'graphile-worker';
import { registry, setupHub } from '../helpers/server';

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
  this.beforeEach(function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);
    registry(this).register('worker-client', StubWorkerClient);
  });

  let { request } = setupHub(this);

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
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(201)
      .expect(function (res) {
        resourceId = res.body.data.id;
        res.body.data.id = 'the-id';
        res.body.data.attributes.did = 'the-did';
      })
      .expect({
        meta: {
          network: 'sokol',
        },
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
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect({
        status: '422',
        title: 'Invalid merchant slug',
        detail: 'The Business ID can only contain lowercase letters or numbers, no special characters',
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
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect({
        status: '422',
        title: 'Invalid merchant slug',
        detail: 'The Business ID cannot be more than 50 characters long. It is currently 51 characters long',
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('validates slug for forbidden words', async function () {
    let requestWithSlug: any = (slug: string) => {
      let payload = {
        data: {
          type: 'merchant-infos',
          attributes: {
            name: 'Satoshi Nakamoto',
            slug: slug,
            color: 'ff0000',
            'text-color': 'ffffff',
            'owner-address': '0x00000000000',
          },
        },
      };

      return request()
        .post('/api/merchant-infos')
        .send(payload)
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json');
    };

    await requestWithSlug('cardstack')
      .expect(422)
      .expect({
        status: '422',
        title: 'Invalid merchant slug',
        detail: 'This Merchant ID is not allowed',
      })
      .expect('Content-Type', 'application/vnd.api+json');

    await requestWithSlug('ethereum')
      .expect(422)
      .expect({
        status: '422',
        title: 'Invalid merchant slug',
        detail: 'This Merchant ID is not allowed',
      })
      .expect('Content-Type', 'application/vnd.api+json');

    await requestWithSlug('fuck')
      .expect(422)
      .expect({
        status: '422',
        title: 'Invalid merchant slug',
        detail: 'This Merchant ID is not allowed',
      })
      .expect('Content-Type', 'application/vnd.api+json');

    await requestWithSlug('urbanoutfitters')
      .expect(422)
      .expect({
        status: '422',
        title: 'Invalid merchant slug',
        detail: 'This Merchant ID is not allowed',
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
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(201);

    await request()
      .post('/api/merchant-infos')
      .send(payload2)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect({
        status: '422',
        title: 'Invalid merchant slug',
        detail: 'This Merchant ID is already taken. Please choose another one',
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });
});

describe('GET /api/merchant-infos/validate-slug/:slug', function () {
  this.beforeEach(function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);
    registry(this).register('worker-client', StubWorkerClient);
  });

  let { request } = setupHub(this);

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
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        slugAvailable: false,
        detail: 'The Business ID can only contain lowercase letters or numbers, no special characters',
      })
      .expect('Content-Type', 'application/vnd.api+json');

    const slug2 = 'sat oshi';
    await request()
      .get(`/api/merchant-infos/validate-slug/${slug2}`)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        slugAvailable: false,
        detail: 'The Business ID can only contain lowercase letters or numbers, no special characters',
      })
      .expect('Content-Type', 'application/vnd.api+json');

    const slug3 = 'Satoshi';
    await request()
      .get(`/api/merchant-infos/validate-slug/${slug3}`)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        slugAvailable: false,
        detail: 'The Business ID can only contain lowercase letters or numbers, no special characters',
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('validates slug for length', async function () {
    const slug = 'satoshisatoshisatoshisatoshisatoshisatoshisatoshi11';
    await request()
      .get(`/api/merchant-infos/validate-slug/${slug}`)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        slugAvailable: false,
        detail: 'The Business ID cannot be more than 50 characters long. It is currently 51 characters long',
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
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(201);

    const slug1 = 'mandello1';
    await request()
      .get(`/api/merchant-infos/validate-slug/${slug1}`)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        slugAvailable: false,
        detail: 'This Merchant ID is already taken. Please choose another one',
      })
      .expect('Content-Type', 'application/vnd.api+json');

    const slug2 = 'mandello2';
    await request()
      .get(`/api/merchant-infos/validate-slug/${slug2}`)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        slugAvailable: true,
        detail: 'Merchant slug is available',
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });
});

describe('GET /api/merchant-infos', function () {
  this.beforeEach(function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);
    registry(this).register('worker-client', StubWorkerClient);
  });

  let { request, getContainer } = setupHub(this);

  it('fetches merchant infos available for association to a new card space', async function () {
    let cardSpaceQueries = await getContainer().lookup('card-space-queries');
    let merchantInfoQueries = await getContainer().lookup('merchant-info-queries');

    // 3 merchants (jerry, kramer, george) belonging to first user
    let merchantInfoId = 'c5cd6479-ec74-4ecd-9aa6-96bdb02d255e';
    await merchantInfoQueries.insert({
      id: merchantInfoId,
      name: '/',
      slug: 'jerry',
      color: '/',
      textColor: '/',
      ownerAddress: stubUserAddress,
    });

    await merchantInfoQueries.insert({
      id: '303c5efa-9cd5-404a-a3fb-9a99969ffcf4',
      name: '/',
      slug: 'kramer',
      color: '/',
      textColor: '/',
      ownerAddress: stubUserAddress,
    });

    await merchantInfoQueries.insert({
      id: '0b9f7594-0f83-4e09-a1ae-d3272decf8fb',
      name: '/',
      slug: 'george',
      color: '/',
      textColor: '/',
      ownerAddress: stubUserAddress,
    });

    // 1 merchant belonging to the second user
    await merchantInfoQueries.insert({
      id: '6484e35a-a581-4246-ac36-c52f69b1cb52',
      name: '/',
      slug: 'elaine',
      color: '/',
      textColor: '/',
      ownerAddress: '0x1',
    });

    // First user registers a card space with jerry merchant
    await cardSpaceQueries.insert({
      id: '255aaa5c-92d0-468b-8939-3dd2d72684c3',
      url: 'jerry.card.space', // To be removed
      profileName: 'Test',
      profileImageUrl: 'https://test.com/test1.png',
      profileCoverImageUrl: 'https://test.com/test2.png',
      profileDescription: 'Test',
      profileButtonText: 'Test',
      profileCategory: 'Test',
      ownerAddress: stubUserAddress,
      merchantId: merchantInfoId,
    });

    // The first user should be able to register 2 more card spaces (1 merchant used, 2 merchants left)
    await request()
      .get('/api/merchant-infos?availableForCardSpace=true')
      .send({})
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        // kramer and george should be available for card space. jerry is already taken, and elaine belongs to another user
        data: [
          {
            attributes: {
              color: '/',
              did: 'did:cardstack:1m6Xtdkc8n7Q7XGwV3Eo2k5qb2777873aaab7bfe',
              name: '/',
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              slug: 'kramer',
              'text-color': '/',
            },
            id: '303c5efa-9cd5-404a-a3fb-9a99969ffcf4',
            type: 'merchant-infos',
          },
          {
            attributes: {
              color: '/',
              did: 'did:cardstack:1m2rfah5ytCe84ae7dGBnGwp44f435150427e4cc',
              name: '/',
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              slug: 'george',
              'text-color': '/',
            },
            id: '0b9f7594-0f83-4e09-a1ae-d3272decf8fb',
            type: 'merchant-infos',
          },
        ],
      });
  });
});
