import { registry, setupHub, setupRegistry } from '../helpers/server';
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

describe('/api/profiles', function () {
  describe('GET /api/profiles/validate-slug/:slug', function () {
    this.beforeEach(function () {
      registry(this).register('authentication-utils', StubAuthenticationUtils);
    });

    let { request } = setupHub(this);

    it('returns 401 without bearer token', async function () {
      const slug = 'slug';
      await request()
        .get(`/api/profiles/validate-slug/${slug}`)
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
        .get(`/api/profiles/validate-slug/${slug1}`)
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(200)
        .expect({
          slugAvailable: false,
          detail: 'Unique ID can only contain lowercase letters or numbers, no special characters',
        })
        .expect('Content-Type', 'application/vnd.api+json');

      const slug2 = 'sat oshi';
      await request()
        .get(`/api/profiles/validate-slug/${slug2}`)
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(200)
        .expect({
          slugAvailable: false,
          detail: 'Unique ID can only contain lowercase letters or numbers, no special characters',
        })
        .expect('Content-Type', 'application/vnd.api+json');

      const slug3 = 'Satoshi';
      await request()
        .get(`/api/profiles/validate-slug/${slug3}`)
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(200)
        .expect({
          slugAvailable: false,
          detail: 'Unique ID can only contain lowercase letters or numbers, no special characters',
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });

    it('validates slug for length', async function () {
      const slug = 'satoshisatoshisatoshisatoshisatoshisatoshisatoshi11';
      await request()
        .get(`/api/profiles/validate-slug/${slug}`)
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(200)
        .expect({
          slugAvailable: false,
          detail: 'Unique ID cannot be more than 50 characters long. It is currently 51 characters long',
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });

    it('validates slug for uniqueness', async function () {
      const payload = {
        data: {
          type: 'profiles',
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
        .post('/api/profiles')
        .send(payload)
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(201);

      const slug1 = 'mandello1';
      await request()
        .get(`/api/profiles/validate-slug/${slug1}`)
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(200)
        .expect({
          slugAvailable: false,
          detail: 'This ID is already taken. Please choose another one',
        })
        .expect('Content-Type', 'application/vnd.api+json');

      const slug2 = 'mandello2';
      await request()
        .get(`/api/profiles/validate-slug/${slug2}`)
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(200)
        .expect({
          slugAvailable: true,
          detail: 'ID is available',
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });
  });

  describe('GET /api/profiles/short-id/:id', function () {
    const fullUuid = 'a7eeb098-f8d6-4926-a47b-c320b7375d6b';
    // shortened using short-uuid, originally 'a7eeb098-f8d6-4926-a47b-c320b7375d6b'
    // this endpoint should convert it back
    const shortenedUuid = 'mJKhNVKyAUgScu1dysmR8R';
    let { request, getPrisma } = setupHub(this);

    this.beforeEach(async function () {
      let prisma = await getPrisma();
      await prisma.profile.create({
        data: {
          id: fullUuid,
          name: 'Merchie!',
          slug: 'slug',
          color: 'red',
          textColor: 'purple',
          ownerAddress: '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
        },
      });
    });

    it('returns 404 if short id cannot be resolved', async function () {
      await request()
        .get(`/api/profiles/short-id/now6HxUjmBfDwTbF76GVHz`)
        .set('Content-Type', 'application/vnd.api+json')
        .expect(404);
    });

    it('can return a profile customization', async function () {
      await request()
        .get(`/api/profiles/short-id/${shortenedUuid}`)
        .set('Content-Type', 'application/vnd.api+json')
        .expect({
          meta: { network: 'sokol' },
          data: {
            id: fullUuid,
            type: 'profiles',
            attributes: {
              did: 'did:cardstack:1mmJKhNVKyAUgScu1dysmR8R728e839d5d105bff',
              name: 'Merchie!',
              slug: 'slug',
              color: 'red',
              'text-color': 'purple',
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              links: [],
              'profile-description': null,
              'profile-image-url': null,
            },
          },
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });
  });
  describe('POST /api/profiles', function () {
    this.beforeEach(function () {
      registry(this).register('authentication-utils', StubAuthenticationUtils);
    });

    let { request } = setupHub(this);

    it('persists profile', async function () {
      const payload = {
        data: {
          type: 'profiles',
          attributes: {
            name: 'Satoshi Nakamoto',
            slug: 'satoshi',
            color: 'ff0000',
            'text-color': 'ffffff',
            'owner-address': '0x00000000000',
          },
        },
      };

      await request()
        .post('/api/profiles')
        .send(payload)
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(201)
        .expect(function (res) {
          res.body.data.id = 'the-id';
          res.body.data.attributes.did = 'the-did';
        })
        .expect({
          meta: {
            network: 'sokol',
          },
          data: {
            type: 'profiles',
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
    });

    it('returns 401 without bearer token', async function () {
      await request()
        .post('/api/profiles')
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
          type: 'profiles',
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
        .post('/api/profiles')
        .send(payload)
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(422)
        .expect({
          status: '422',
          title: 'Invalid profile slug',
          detail: 'Unique ID can only contain lowercase letters or numbers, no special characters',
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });

    it('validates slug for length', async function () {
      const payload = {
        data: {
          type: 'profiles',
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
        .post('/api/profiles')
        .send(payload)
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(422)
        .expect({
          status: '422',
          title: 'Invalid profile slug',
          detail: 'Unique ID cannot be more than 50 characters long. It is currently 51 characters long',
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });

    it('validates name for length', async function () {
      const payload = {
        data: {
          type: 'profiles',
          attributes: {
            name: 'a'.repeat(51),
            slug: 'satoshi',
            color: 'ff0000',
            'text-color': 'ffffff',
            'owner-address': '0x00000000000',
          },
        },
      };

      await request()
        .post('/api/profiles')
        .send(payload)
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(422)
        .expect({
          status: '422',
          title: 'Invalid profile name',
          detail: 'Profile name cannot exceed 50 characters',
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });

    it('validates slug for forbidden words', async function () {
      let requestWithSlug: any = (slug: string) => {
        let payload = {
          data: {
            type: 'profiles',
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
          .post('/api/profiles')
          .send(payload)
          .set('Authorization', 'Bearer abc123--def456--ghi789')
          .set('Accept', 'application/vnd.api+json')
          .set('Content-Type', 'application/vnd.api+json');
      };

      await requestWithSlug('cardstack')
        .expect(422)
        .expect({
          status: '422',
          title: 'Invalid profile slug',
          detail: 'This ID is not allowed',
        })
        .expect('Content-Type', 'application/vnd.api+json');

      await requestWithSlug('ethereum')
        .expect(422)
        .expect({
          status: '422',
          title: 'Invalid profile slug',
          detail: 'This ID is not allowed',
        })
        .expect('Content-Type', 'application/vnd.api+json');

      await requestWithSlug('fuck')
        .expect(422)
        .expect({
          status: '422',
          title: 'Invalid profile slug',
          detail: 'This ID is not allowed',
        })
        .expect('Content-Type', 'application/vnd.api+json');

      await requestWithSlug('urbanoutfitters')
        .expect(422)
        .expect({
          status: '422',
          title: 'Invalid profile slug',
          detail: 'This ID is not allowed',
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });

    it('validates slug for uniqueness', async function () {
      const payload = {
        data: {
          type: 'profiles',
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
          type: 'profiles',
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
        .post('/api/profiles')
        .send(payload)
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(201);

      await request()
        .post('/api/profiles')
        .send(payload2)
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(422)
        .expect({
          status: '422',
          title: 'Invalid profile slug',
          detail: 'This ID is already taken. Please choose another one',
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });
  });

  describe('PATCH /api/profiles', function () {
    setupRegistry(this, ['authentication-utils', StubAuthenticationUtils]);
    let { request, getPrisma } = setupHub(this);

    it('returns 404 when resource does not exist', async function () {
      await request()
        .patch('/api/profiles/AB70B8D5-95F5-4C20-997C-4DB9013B347C')
        .send({})
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(404);
    });

    it('returns 403 when resource does not belong to wallet', async function () {
      let profileId = uuidv4();
      let prisma = await getPrisma();
      await prisma.profile.create({
        data: {
          id: profileId,
          ownerAddress: '0x1234',
          name: 'Satoshi?',
          slug: 'satoshi',
          color: 'black',
          textColor: 'red',
          profileDescription: 'Test',
        },
      });

      await request()
        .patch(`/api/profiles/${profileId}`)
        .send({})
        .set('Authorization', 'Bearer abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(403);
    });

    it('returns 401 without bearer token', async function () {
      await request()
        .patch('/api/profiles/AB70B8D5-95F5-4C20-997C-4DB9013B347C')
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

    it('updates specified fields of the resource that are permitted', async function () {
      let profileId = 'ab70b8d5-95f5-4c20-997c-4db9013b347c';

      let prisma = await getPrisma();
      await prisma.profile.create({
        data: {
          id: profileId,
          ownerAddress: stubUserAddress,
          name: 'Satoshi?',
          slug: 'satoshi',
          color: 'black',
          textColor: 'red',
          profileDescription: "Satoshi's place",
          profileImageUrl: 'https://test.com/profile.jpg',
        },
      });

      let payload = {
        data: {
          type: 'profiles',
          attributes: {
            name: 'anewname',
            color: 'blue',
            'text-color': 'blue',
            links: [{ title: 'Link1', url: 'https://test.com/something' }],
            slug: 'anewslugthatwillnotbesaved',
          },
        },
      };

      await request()
        .patch(`/api/profiles/${profileId}`)
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
            type: 'profiles',
            id: 'ab70b8d5-95f5-4c20-997c-4db9013b347c',
            attributes: {
              did: 'did:cardstack:1mnaSutV4uMuyyJZcJ7ktsTw991de486680a9262',
              name: 'anewname',
              slug: 'satoshi',
              color: 'blue',
              'text-color': 'blue',
              'owner-address': '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              'profile-description': "Satoshi's place",
              'profile-image-url': 'https://test.com/profile.jpg',
              links: [{ title: 'Link1', url: 'https://test.com/something' }],
            },
          },
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });

    it('returns errors when updating a resource with invalid attributes', async function () {
      let profileId = uuidv4();

      let prisma = await getPrisma();
      await prisma.profile.create({
        data: {
          id: profileId,
          ownerAddress: stubUserAddress,
          name: 'Satoshi?',
          slug: 'satoshi',
          color: 'black',
          textColor: 'red',
          profileDescription: 'Test',
        },
      });

      let payload = {
        data: {
          type: 'profiles',
          attributes: {
            name: 'satoshisatoshisatoshisatoshisatoshisatoshisatoshi11',
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
        .patch(`/api/profiles/${profileId}`)
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
              source: { pointer: '/data/attributes/name' },
              detail: 'Max length is 50',
            },
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
});
