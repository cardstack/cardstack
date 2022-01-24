import { Job, TaskSpec } from 'graphile-worker';
import { registry, setupHub } from '../helpers/server';
import { v4 as uuidv4 } from 'uuid';

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
      await getContainer().lookup('merchant-info-queries')
    ).insert({
      id: merchantId, // Can’t insert without an id?
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
          'merchant-id': merchantId,
          'profile-name': 'Satoshi Nakamoto',
          'profile-description': "Satoshi's place",
          'profile-category': 'entertainment',
          'profile-image-url': 'https://test.com/test1.png',
          'profile-cover-image-url': 'https://test.com/test2.png',
          'profile-button-text': 'Visit this Space',
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
            'merchant-id': merchantId,
            'profile-name': 'Satoshi Nakamoto',
            'profile-description': "Satoshi's place",
            'profile-category': 'entertainment',
            'profile-image-url': 'https://test.com/test1.png',
            'profile-cover-image-url': 'https://test.com/test2.png',
            'profile-button-text': 'Visit this Space',
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
            detail: 'Must be present',
            source: { pointer: '/data/attributes/merchant-id' },
            status: '422',
            title: 'Invalid attribute',
          },
        ],
      });
  });

  it('returns 422 when the merchant doesn’t exist', async function () {
    let merchantId = uuidv4();
    await (
      await getContainer().lookup('merchant-info-queries')
    ).insert({
      id: merchantId, // Can’t insert without an id?
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
          'merchant-id': payloadMerchantId,
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
            detail: `Given merchant-id ${payloadMerchantId} was not found`,
            source: { pointer: '/data/attributes/merchant-id' },
            status: '422',
            title: 'Invalid attribute',
          },
        ],
      });
  });
});

describe('POST /api/card-spaces/validate-profile-category', async function () {
  this.beforeEach(function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);
  });
  let { request } = setupHub(this);

  it('returns no category errors when category is valid', async function () {
    await request()
      .post(`/api/card-spaces/validate-profile-category`)
      .send({ data: { attributes: { 'profile-category': 'yes' } } })
      .set('Authorization', 'Bearer: abc123--def456--ghi789') // FIXME note colon, and below
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        errors: [],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('returns an error when category name is profane', async function () {
    await request()
      .post(`/api/card-spaces/validate-profile-category`)
      .send({ data: { attributes: { 'profile-category': "fuck this isn't valid" } } })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        errors: [
          {
            status: '422',
            title: 'Invalid attribute',
            source: {
              pointer: `/data/attributes/profile-category`,
            },
            detail: 'Category is not allowed',
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('returns category errors when category is invalid', async function () {
    await request()
      .post(`/api/card-spaces/validate-profile-category`)
      .send({ data: { attributes: { 'profile-category': '123456789012345678901234567890123456789012345678901' } } })
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        errors: [
          {
            status: '422',
            title: 'Invalid attribute',
            source: { pointer: `/data/attributes/profile-category` },
            detail: 'Max length is 50',
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('returns 401 without bearer token', async function () {
    await request()
      .post('/api/card-spaces/validate-profile-category')
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
});

describe('POST /api/card-spaces/validate-profile-name', async function () {
  this.beforeEach(function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);
    registry(this).register('worker-client', StubWorkerClient);
  });
  let { request } = setupHub(this);

  it('returns no url errors when profile name is available', async function () {
    await request()
      .post(`/api/card-spaces/validate-profile-name`)
      .send({ data: { attributes: { 'profile-name': 'Valid Profile Name' } } })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        errors: [],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('returns an error when profile name is profane', async function () {
    await request()
      .post(`/api/card-spaces/validate-profile-name`)
      .send({ data: { attributes: { 'profile-name': "fuck this isn't valid" } } })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        errors: [
          {
            status: '422',
            title: 'Invalid attribute',
            source: {
              pointer: `/data/attributes/profile-name`,
            },
            detail: 'Username is not allowed',
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('returns an error when profile name is too long', async function () {
    await request()
      .post(`/api/card-spaces/validate-profile-name`)
      .send({
        data: { attributes: { 'profile-name': 'morethanfiftymorethanfiftymorethanfiftymorethanfiftymorethanfifty' } },
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        errors: [
          {
            status: '422',
            title: 'Invalid attribute',
            source: {
              pointer: `/data/attributes/profile-name`,
            },
            detail: 'Max length is 50',
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
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

  it.skip('returns 403 when resource does not belong to wallet', async function () {
    await (
      await getContainer().lookup('merchant-info-queries')
    ).insert({
      id: uuidv4(), // Can’t insert without an id?
      ownerAddress: '0x1234',
      name: 'Satoshi?',
      slug: 'satoshi',
      color: 'black',
      textColor: 'red',
    });

    let dbManager = await getContainer().lookup('database-manager');
    let db = await dbManager.getClient();
    await db.query(
      'INSERT INTO card_spaces(id, profile_name, profile_description, profile_category, profile_button_text, owner_address) VALUES($1, $2, $3, $4, $5, $6)',
      ['AB70B8D5-95F5-4C20-997C-4DB9013B347C', 'Test', 'Test', 'Test', 'Visit this Space', '0x00']
    );

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

  it.skip('updates the resource', async function () {
    let dbManager = await getContainer().lookup('database-manager');
    let db = await dbManager.getClient();
    await db.query(
      'INSERT INTO card_spaces(id, profile_name, profile_description, profile_category, profile_button_text, profile_image_url, profile_cover_image_url, owner_address) VALUES($1, $2, $3, $4, $5, $6, $7, $8)',
      [
        'AB70B8D5-95F5-4C20-997C-4DB9013B347C',
        'Satoshi Nakamoto',
        "Satoshi's place",
        'entertainment',
        'Visit this Space',
        'https://test.com/profile.jpg',
        'https://test.com/cover.jpg',
        '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
      ]
    );

    let payload = {
      data: {
        type: 'card-spaces',
        attributes: {
          'profile-name': 'Satoshi Nakamoto',
          'profile-description': "Satoshi's place",
          'profile-category': 'entertainment',
          'profile-image-url': 'https://test.com/profile.jpg',
          'profile-cover-image-url': 'https://test.com/cover.jpg',
          'profile-button-text': 'Visit this Space',
          'bio-title': 'Innovator',
          'bio-description': "I'm a wealthy industrialist and philanthropist, and a bicyclist.",
          links: [{ title: 'Link1', url: 'https://test.com' }],
          'donation-title': 'The Human Fund',
          'donation-description': 'A donation will be made in your name to the Human Fund',
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
            'profile-name': 'Satoshi Nakamoto',
            'profile-description': "Satoshi's place",
            'profile-category': 'entertainment',
            'profile-image-url': 'https://test.com/profile.jpg',
            'profile-cover-image-url': 'https://test.com/cover.jpg',
            'profile-button-text': 'Visit this Space',
            'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
            'bio-title': 'Innovator',
            'bio-description': "I'm a wealthy industrialist and philanthropist, and a bicyclist.",
            links: [{ title: 'Link1', url: 'https://test.com' }],
            'donation-title': 'The Human Fund',
            'donation-description': 'A donation will be made in your name to the Human Fund',
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it.skip('returns errors when updating a resource with invalid attributes', async function () {
    let dbManager = await getContainer().lookup('database-manager');
    let db = await dbManager.getClient();
    await db.query(
      'INSERT INTO card_spaces(id, profile_name, profile_description, profile_category, profile_button_text, owner_address) VALUES($1, $2, $3, $4, $5, $6)',
      [
        'AB70B8D5-95F5-4C20-997C-4DB9013B347C',
        'Test',
        'Test',
        'Test',
        'Visit this Space',
        '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
      ]
    );

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
          'bio-title': 'Innovator',
          'bio-description': "I'm a wealthy industrialist and philanthropist, and a bicyclist.",
          links: [
            {
              title: 'very long long long long much too long string for a link title',
              url: 'https://twitter.com/satoshi',
            },
            { title: '', url: 'invalid' },
          ],
          'donation-title': 'The Human Fund',
          'donation-description': 'A donation will be made in your name to the Human Fund',
          'donation-suggestion-amount-1': 'a million',
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
          {
            status: '422',
            title: 'Invalid attribute',
            source: { pointer: `/data/attributes/donation-suggestion-amount-1` },
            detail: 'Must be an integer',
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });
});
