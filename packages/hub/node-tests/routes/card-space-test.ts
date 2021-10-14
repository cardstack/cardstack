import supertest, { Test } from 'supertest';
import { HubServer } from '../../main';
import { Registry } from '@cardstack/di';
import { Job, TaskSpec } from 'graphile-worker';

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
  let server: HubServer;
  let request: supertest.SuperTest<Test>;

  this.beforeEach(async function () {
    server = await HubServer.create({
      registryCallback(registry: Registry) {
        registry.register('authentication-utils', StubAuthenticationUtils);
        registry.register('worker-client', StubWorkerClient);
      },
    });

    request = supertest(server.app.callback());
  });

  this.afterEach(async function () {
    server.teardown();
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

    await request
      .post('/api/card-spaces')
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
    let dbManager = await server.container.lookup('database-manager');
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

    await request
      .post('/api/card-spaces')
      .send(payload)
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
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

    await request
      .post('/api/card-spaces')
      .send(payload)
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
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
            detail: 'Invalid URL',
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

    await request
      .post('/api/card-spaces')
      .send(payload)
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
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
            detail: 'Only card.space subdomains are allowed',
          },
          {
            status: '422',
            source: {
              pointer: '/data/attributes/url',
            },
            title: 'Invalid attribute',
            detail: 'Only first level subdomains are allowed',
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('returns 401 without bearer token', async function () {
    await request
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
