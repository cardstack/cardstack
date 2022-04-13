import { Job, TaskSpec } from 'graphile-worker';
import { CardSpace } from '../../routes/card-spaces';
import { registry, setupHub } from '../helpers/server';
import { v4 as uuidv4 } from 'uuid';
import { encodeDID } from '@cardstack/did-resolver';

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

let stubUserAddress = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';
function handleValidateAuthToken(encryptedString: string) {
  expect(encryptedString).to.equal('abc123--def456--ghi789');
  return stubUserAddress;
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

describe('GET /api/card-spaces/:slug', function () {
  let { request, getContainer } = setupHub(this);

  it('fetches a card space', async function () {
    let merchantId = uuidv4();
    await (
      await getContainer().lookup('merchant-info', { type: 'query' })
    ).insert({
      id: merchantId,
      ownerAddress: stubUserAddress,
      name: 'Satoshi?',
      slug: 'satoshi',
      color: 'black',
      textColor: 'red',
    });

    const id = 'c8e7ceed-d5f2-4f66-be77-d81806e66ad7';
    const cardSpace: CardSpace = {
      id,
      profileDescription: "Satoshi's place",
      profileImageUrl: 'https://test.com/test1.png',
      merchantId,
    };

    await (await getContainer().lookup('card-space', { type: 'query' })).insert(cardSpace);

    await request()
      .get('/api/card-spaces/satoshi')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        meta: {
          network: 'sokol',
        },
        data: {
          type: 'card-spaces',
          id,
          attributes: {
            did: 'did:cardstack:1csqNUmMUPV16eUWwjxGZNZ2r68a319e3ae1d2606',
            'profile-description': "Satoshi's place",
            'profile-image-url': 'https://test.com/test1.png',
            links: [],
          },
          relationships: {
            'merchant-info': {
              data: {
                type: 'merchant-infos',
                id: merchantId,
              },
            },
          },
        },
        included: [
          {
            type: 'merchant-infos',
            id: merchantId,
            attributes: {
              color: 'black',
              did: encodeDID({ type: 'MerchantInfo', uniqueId: merchantId }),
              name: 'Satoshi?',
              'owner-address': stubUserAddress,
              slug: 'satoshi',
              'text-color': 'red',
            },
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('returns 404 when user does not exist', async function () {
    await request()
      .get('/api/card-spaces/satoshi')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(404);
  });
});

describe('POST /api/card-spaces', function () {
  this.beforeEach(function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);
    registry(this).register('worker-client', StubWorkerClient);
  });
  let { request, getContainer } = setupHub(this);

  this.afterEach(async function () {
    lastAddedJobIdentifier = undefined;
    lastAddedJobPayload = undefined;
  });

  it('persists card space', async function () {
    let merchantId = uuidv4();
    await (
      await getContainer().lookup('merchant-info', { type: 'query' })
    ).insert({
      id: merchantId,
      ownerAddress: stubUserAddress,
      name: 'Satoshi?',
      slug: 'satoshi',
      color: 'black',
      textColor: 'red',
    });

    let payload = {
      data: {
        type: 'card-spaces',
        attributes: {
          'profile-description': "Satoshi's place",
          'profile-image-url': 'https://test.com/test1.png',
        },
        relationships: {
          'merchant-info': {
            data: {
              type: 'merchant-infos',
              id: merchantId,
            },
          },
        },
      },
    };

    let resourceId = null;

    await request()
      .post('/api/card-spaces')
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
          type: 'card-spaces',
          id: 'the-id',
          attributes: {
            did: 'the-did',
            'profile-description': "Satoshi's place",
            'profile-image-url': 'https://test.com/test1.png',
          },
          relationships: {
            'merchant-info': {
              data: {
                type: 'merchant-infos',
                id: merchantId,
              },
            },
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');

    expect(lastAddedJobIdentifier).to.equal('persist-off-chain-card-space');
    expect(lastAddedJobPayload).to.deep.equal({ id: resourceId });
  });

  it('returns 401 without bearer token', async function () {
    await request()
      .post('/api/card-spaces')
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

  it('returns 403 when the related merchant has a different owner', async function () {
    let merchantId = uuidv4();
    await (
      await getContainer().lookup('merchant-info', { type: 'query' })
    ).insert({
      id: merchantId,
      ownerAddress: '0xmystery',
      name: 'Satoshi?',
      slug: 'satoshi',
      color: 'black',
      textColor: 'red',
    });

    let payload = {
      data: {
        type: 'card-spaces',
        attributes: {
          'profile-name': 'Satoshi Nakamoto',
          'profile-description': "Satoshi's place",
          'profile-category': 'entertainment',
          'profile-image-url': 'https://test.com/test1.png',
          'profile-cover-image-url': 'https://test.com/test2.png',
          'profile-button-text': 'Visit this Space',
        },
        relationships: {
          'merchant-info': {
            data: {
              type: 'merchant-infos',
              id: merchantId,
            },
          },
        },
      },
    };

    await request()
      .post('/api/card-spaces')
      .send(payload)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(403)
      .expect({
        errors: [
          {
            detail: `Given merchant-id ${merchantId} is not owned by the user`,
            source: { pointer: '/data/relationships/merchant-info' },
            status: '403',
            title: 'Invalid relationship',
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('returns 422 when the merchant id is not specified', async function () {
    let payload = {
      data: {
        type: 'card-spaces',
        attributes: {
          'profile-name': 'Satoshi Nakamoto',
          'profile-description': "Satoshi's place",
          'profile-category': 'entertainment',
          'profile-image-url': 'https://test.com/test1.png',
          'profile-cover-image-url': 'https://test.com/test2.png',
          'profile-button-text': 'Visit this Space',
        },
      },
    };

    await request()
      .post('/api/card-spaces')
      .send(payload)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect({
        errors: [
          {
            detail: 'Required relationship merchant-info was not provided',
            status: '422',
            title: 'Missing required relationship: merchant-info',
          },
        ],
      });
  });

  it('returns 422 when the merchant doesn’t exist', async function () {
    let merchantId = uuidv4();
    await (
      await getContainer().lookup('merchant-info', { type: 'query' })
    ).insert({
      id: merchantId,
      ownerAddress: stubUserAddress,
      name: 'Satoshi?',
      slug: 'satoshi',
      color: 'black',
      textColor: 'red',
    });

    let payloadMerchantId = uuidv4();

    let payload = {
      data: {
        type: 'card-spaces',
        attributes: {
          'profile-name': 'Satoshi Nakamoto',
          'profile-description': "Satoshi's place",
          'profile-category': 'entertainment',
          'profile-image-url': 'https://test.com/test1.png',
          'profile-cover-image-url': 'https://test.com/test2.png',
          'profile-button-text': 'Visit this Space',
        },
        relationships: {
          'merchant-info': {
            data: {
              type: 'merchant-infos',
              id: payloadMerchantId,
            },
          },
        },
      },
    };

    await request()
      .post('/api/card-spaces')
      .send(payload)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect({
        errors: [
          {
            detail: `Given merchant-id ${payloadMerchantId} was not found`,
            source: { pointer: '/data/relationships/merchant-info' },
            status: '422',
            title: 'Invalid relationship',
          },
        ],
      });
  });
});

describe('PUT /api/card-spaces', function () {
  this.beforeEach(function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);
    registry(this).register('worker-client', StubWorkerClient);
  });

  let { request, getContainer } = setupHub(this);

  this.afterEach(async function () {
    lastAddedJobIdentifier = undefined;
    lastAddedJobPayload = undefined;
  });

  it('returns 404 when resource does not exist', async function () {
    await request()
      .put('/api/card-spaces/AB70B8D5-95F5-4C20-997C-4DB9013B347C')
      .send({})
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(404);
  });

  it('returns 403 when resource does not belong to wallet', async function () {
    let merchantId = uuidv4();

    await (
      await getContainer().lookup('merchant-info', { type: 'query' })
    ).insert({
      id: merchantId,
      ownerAddress: '0x1234',
      name: 'Satoshi?',
      slug: 'satoshi',
      color: 'black',
      textColor: 'red',
    });

    let dbManager = await getContainer().lookup('database-manager');
    let db = await dbManager.getClient();
    await db.query('INSERT INTO card_spaces(id, profile_description, merchant_id) VALUES($1, $2, $3)', [
      'AB70B8D5-95F5-4C20-997C-4DB9013B347C',
      'Test',
      merchantId,
    ]);

    await request()
      .put('/api/card-spaces/AB70B8D5-95F5-4C20-997C-4DB9013B347C')
      .send({})
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(403);
  });

  it('returns 401 without bearer token', async function () {
    await request()
      .post('/api/card-spaces')
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

  it('updates the resource', async function () {
    let dbManager = await getContainer().lookup('database-manager');
    let db = await dbManager.getClient();
    let merchantId = uuidv4();

    await (
      await getContainer().lookup('merchant-info', { type: 'query' })
    ).insert({
      id: merchantId,
      ownerAddress: stubUserAddress,
      name: 'Satoshi?',
      slug: 'satoshi',
      color: 'black',
      textColor: 'red',
    });

    await db.query(
      'INSERT INTO card_spaces(id, profile_description, profile_image_url, merchant_id) VALUES($1, $2, $3, $4)',
      ['AB70B8D5-95F5-4C20-997C-4DB9013B347C', "Satoshi's place", 'https://test.com/profile.jpg', merchantId]
    );

    let payload = {
      data: {
        type: 'card-spaces',
        attributes: {
          'profile-description': "Satoshi's place, v2",
          'profile-image-url': 'https://test.com/profile-v2.jpg',
          links: [{ title: 'Link1', url: 'https://test.com' }],
        },
      },
    };

    await request()
      .put('/api/card-spaces/AB70B8D5-95F5-4C20-997C-4DB9013B347C')
      .send(payload)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        meta: {
          network: 'sokol',
        },
        data: {
          type: 'card-spaces',
          id: 'ab70b8d5-95f5-4c20-997c-4db9013b347c',
          attributes: {
            did: 'did:cardstack:1csnaSutV4uMuyyJZcJ7ktsTwdec10adda76d48c7',
            'profile-description': "Satoshi's place, v2",
            'profile-image-url': 'https://test.com/profile-v2.jpg',
            links: [{ title: 'Link1', url: 'https://test.com' }],
          },
          relationships: {
            'merchant-info': {
              data: {
                id: merchantId,
                type: 'merchant-infos',
              },
            },
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('returns errors when updating a resource with invalid attributes', async function () {
    let dbManager = await getContainer().lookup('database-manager');
    let db = await dbManager.getClient();

    let merchantId = uuidv4();

    await (
      await getContainer().lookup('merchant-info', { type: 'query' })
    ).insert({
      id: merchantId,
      ownerAddress: stubUserAddress,
      name: 'Satoshi?',
      slug: 'satoshi',
      color: 'black',
      textColor: 'red',
    });

    await db.query('INSERT INTO card_spaces(id, profile_description, merchant_id) VALUES($1, $2, $3)', [
      'AB70B8D5-95F5-4C20-997C-4DB9013B347C',
      'Test',
      merchantId,
    ]);

    let payload = {
      data: {
        type: 'card-spaces',
        attributes: {
          'profile-description': "Satoshi's place",
          'profile-image-url': 'https://test.com/test1.png',
          links: [
            {
              title: 'very long long long long much too long string for a link title',
              url: 'https://twitter.com/satoshi',
            },
            { title: '', url: 'invalid' },
          ],
        },
      },
    };

    await request()
      .put('/api/card-spaces/AB70B8D5-95F5-4C20-997C-4DB9013B347C')
      .send(payload)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect({
        errors: [
          {
            status: '422',
            title: 'Invalid attribute',
            source: { pointer: `/data/attributes/links/0/title` },
            detail: 'Max length is 50',
          },
          {
            status: '422',
            title: 'Invalid attribute',
            source: { pointer: `/data/attributes/links/1/title` },
            detail: 'Must be present',
          },
          {
            status: '422',
            title: 'Invalid attribute',
            source: { pointer: `/data/attributes/links/1/url` },
            detail: 'Invalid URL',
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });
});
