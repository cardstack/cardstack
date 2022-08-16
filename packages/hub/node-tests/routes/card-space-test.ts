import { setupHub } from '../helpers/server';
import { encodeDID } from '@cardstack/did-resolver';

let stubUserAddress = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';

describe('GET /api/card-spaces/:slug', function () {
  let { request, getPrisma } = setupHub(this);

  it('fetches a card space', async function () {
    let profileId = 'c8e7ceed-d5f2-4f66-be77-d81806e66ad7';
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
        profileImageUrl: 'https://test.com/test1.png',
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
          id: profileId,
          attributes: {
            did: 'did:cardstack:1mqNUmMUPV16eUWwjxGZNZ2rf0cf79e28ca4125e',
            'profile-description': "Satoshi's place",
            'profile-image-url': 'https://test.com/test1.png',
            links: [],
          },
          relationships: {
            'merchant-info': {
              data: {
                type: 'merchant-infos',
                id: profileId,
              },
            },
          },
        },
        included: [
          {
            type: 'merchant-infos',
            id: profileId,
            attributes: {
              color: 'black',
              did: encodeDID({ type: 'MerchantInfo', uniqueId: profileId }),
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
