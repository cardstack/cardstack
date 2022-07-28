import { setupRegistry, setupHub } from '../helpers/server';
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

describe('GET /api/card-spaces/:slug', function () {
  let { request, getPrisma } = setupHub(this);

  it('fetches a card space', async function () {
    let merchantId = 'c8e7ceed-d5f2-4f66-be77-d81806e66ad7';
    let prisma = await getPrisma();
    await prisma.profile.create({
      data: {
        id: merchantId,
        ownerAddress: stubUserAddress,
        name: 'Satoshi?',
        slug: 'satoshi',
        color: 'black',
        textColor: 'red',
        profileDescription: "Satoshi's place",
        profileImageUrl: 'https://test.com/test1.png',
        createdAt: new Date(),
      },
    });

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
          id: merchantId,
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

describe('PATCH /api/card-spaces', function () {
  setupRegistry(this, ['authentication-utils', StubAuthenticationUtils]);
  let { request, getPrisma } = setupHub(this);

  it('returns 404 when resource does not exist', async function () {
    await request()
      .patch('/api/card-spaces/AB70B8D5-95F5-4C20-997C-4DB9013B347C')
      .send({})
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(404);
  });

  it('returns 403 when resource does not belong to wallet', async function () {
    let merchantId = uuidv4();
    let prisma = await getPrisma();
    await prisma.profile.create({
      data: {
        id: merchantId,
        ownerAddress: '0x1234',
        name: 'Satoshi?',
        slug: 'satoshi',
        color: 'black',
        textColor: 'red',
        profileDescription: 'Test',
        createdAt: new Date(),
      },
    });

    await request()
      .patch(`/api/card-spaces/${merchantId}`)
      .send({})
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(403);
  });

  it('returns 401 without bearer token', async function () {
    await request()
      .patch('/api/card-spaces/AB70B8D5-95F5-4C20-997C-4DB9013B347C')
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

  it('updates the specified fields of the resource', async function () {
    let merchantId = 'ab70b8d5-95f5-4c20-997c-4db9013b347c';

    let prisma = await getPrisma();
    await prisma.profile.create({
      data: {
        id: merchantId,
        ownerAddress: stubUserAddress,
        name: 'Satoshi?',
        slug: 'satoshi',
        color: 'black',
        textColor: 'red',
        profileDescription: "Satoshi's place",
        profileImageUrl: 'https://test.com/profile.jpg',
        createdAt: new Date(),
      },
    });

    let payload = {
      data: {
        type: 'card-spaces',
        attributes: {
          links: [{ title: 'Link1', url: 'https://test.com/something' }],
        },
      },
    };

    await request()
      .patch(`/api/card-spaces/${merchantId}`)
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
            'profile-description': "Satoshi's place",
            'profile-image-url': 'https://test.com/profile.jpg',
            links: [{ title: 'Link1', url: 'https://test.com/something' }],
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
    let merchantId = uuidv4();

    let prisma = await getPrisma();
    await prisma.profile.create({
      data: {
        id: merchantId,
        ownerAddress: stubUserAddress,
        name: 'Satoshi?',
        slug: 'satoshi',
        color: 'black',
        textColor: 'red',
        profileDescription: 'Test',
        createdAt: new Date(),
      },
    });

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
      .patch(`/api/card-spaces/${merchantId}`)
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
