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
    let payload = {
      data: {
        type: 'card-spaces',
        attributes: {
          url: 'satoshi.card.space',
          'profile-name': 'Satoshi Nakamoto',
          'profile-description': "Satoshi's place",
          'profile-category': 'entertainment',
          'profile-image-url': 'https://test.com/test1.png',
          'profile-cover-image-url': 'https://test.com/test2.png',
          'profile-button-text': 'Visit this Space',
          'owner-address': '0x00000000000',
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
            'profile-name': 'Satoshi Nakamoto',
            url: 'satoshi.card.space',
            'profile-description': "Satoshi's place",
            'profile-category': 'entertainment',
            'profile-image-url': 'https://test.com/test1.png',
            'profile-cover-image-url': 'https://test.com/test2.png',
            'profile-button-text': 'Visit this Space',
            'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');

    expect(lastAddedJobIdentifier).to.equal('persist-off-chain-card-space');
    expect(lastAddedJobPayload).to.deep.equal({ id: resourceId });
  });

  it('returns an error when card space with same url is already present', async function () {
    let dbManager = await getContainer().lookup('database-manager');
    let db = await dbManager.getClient();
    await db.query(
      'INSERT INTO card_spaces(id, url, profile_name, profile_description, profile_category, profile_button_text, owner_address) VALUES($1, $2, $3, $4, $5, $6, $7)',
      ['AB70B8D5-95F5-4C20-997C-4DB9013B347C', 'satoshi.card.space', 'Test', 'Test', 'Test', 'Test', '0x0']
    );

    let payload = {
      data: {
        type: 'card-spaces',
        attributes: {
          url: 'satoshi.card.space', // Already inserted above
          'profile-name': 'Satoshi Nakamoto',
          'profile-description': "Satoshi's place",
          'profile-category': 'entertainment',
          'profile-image-url': 'https://test.com/test1.png',
          'profile-cover-image-url': 'https://test.com/test2.png',
          'profile-button-text': 'Visit this Space',
          'owner-address': '0x00000000000',
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
            status: '422',
            source: {
              pointer: '/data/attributes/url',
            },
            title: 'Invalid attribute',
            detail: 'Already exists',
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('returns an error when card space url is invalid', async function () {
    let payload = {
      data: {
        type: 'card-spaces',
        attributes: {
          url: 'sato shi.card.space',
          'profile-name': 'Satoshi Nakamoto',
          'profile-description': "Satoshi's place",
          'profile-category': 'entertainment',
          'profile-image-url': 'https://test.com/test1.png',
          'profile-cover-image-url': 'https://test.com/test2.png',
          'profile-button-text': 'Visit this Space',
          'owner-address': '0x00000000000',
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
            status: '422',
            source: {
              pointer: '/data/attributes/url',
            },
            title: 'Invalid attribute',
            detail: 'Can only contain latin letters, numbers, hyphens and underscores',
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('returns errors when card space url is not first level card.space subdomain', async function () {
    let payload = {
      data: {
        type: 'card-spaces',
        attributes: {
          url: 'satoshi.nakamoto.card.race',
          'profile-name': 'Satoshi Nakamoto',
          'profile-description': "Satoshi's place",
          'profile-category': 'entertainment',
          'profile-image-url': 'https://test.com/test1.png',
          'profile-cover-image-url': 'https://test.com/test2.png',
          'profile-button-text': 'Visit this Space',
          'owner-address': '0x00000000000',
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
            status: '422',
            source: {
              pointer: '/data/attributes/url',
            },
            title: 'Invalid attribute',
            detail: 'Can only contain latin letters, numbers, hyphens and underscores',
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

describe('POST /api/card-spaces/validate-url', async function () {
  this.beforeEach(function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);
    registry(this).register('worker-client', StubWorkerClient);
  });
  let { request, getContainer } = setupHub(this);

  it('returns no url errors when url is available', async function () {
    await request()
      .post(`/api/card-spaces/validate-url`)
      .send({ data: { attributes: { url: 'satoshi.card.space' } } })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        errors: [],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('returns url errors when url is already used', async function () {
    let dbManager = await getContainer().lookup('database-manager');
    let db = await dbManager.getClient();
    await db.query(
      'INSERT INTO card_spaces(id, profile_name, url, profile_description, profile_category, profile_button_text, owner_address) VALUES($1, $2, $3, $4, $5, $6, $7)',
      ['AB70B8D5-95F5-4C20-997C-4DB9013B347C', 'Test', 'satoshi.card.space', 'Test', 'Test', 'Test', '0x0']
    );

    await request()
      .post(`/api/card-spaces/validate-url`)
      .send({ data: { attributes: { url: 'satoshi.card.space' } } })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        errors: [
          {
            status: '422',
            title: 'Invalid attribute',
            source: { pointer: `/data/attributes/url` },
            detail: 'Already exists',
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
    let dbManager = await getContainer().lookup('database-manager');
    let db = await dbManager.getClient();
    await db.query(
      'INSERT INTO card_spaces(id, url, profile_name, profile_description, profile_category, profile_button_text, owner_address) VALUES($1, $2, $3, $4, $5, $6, $7)',
      ['AB70B8D5-95F5-4C20-997C-4DB9013B347C', 'satoshi.card.space', 'Test', 'Test', 'Test', 'Visit this Space', '0x0']
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

  it('updates the resource', async function () {
    let dbManager = await getContainer().lookup('database-manager');
    let db = await dbManager.getClient();
    await db.query(
      'INSERT INTO card_spaces(id, url, profile_name, profile_description, profile_category, profile_button_text, profile_image_url, profile_cover_image_url, owner_address) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [
        'AB70B8D5-95F5-4C20-997C-4DB9013B347C',
        'satoshi.card.space',
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
          url: 'satoshi.card.space',
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
            url: 'satoshi.card.space',
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

  it('returns errors when updating a resource with invalid attributes', async function () {
    let dbManager = await getContainer().lookup('database-manager');
    let db = await dbManager.getClient();
    await db.query(
      'INSERT INTO card_spaces(id, url, profile_name, profile_description, profile_category, profile_button_text, owner_address) VALUES($1, $2, $3, $4, $5, $6, $7)',
      [
        'AB70B8D5-95F5-4C20-997C-4DB9013B347C',
        'satoshi.card.space',
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
          url: 'satoshi.card.space',
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
