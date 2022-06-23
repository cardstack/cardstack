import { registry, setupHub } from '../helpers/server';
import CardSpaceQueries from '../../queries/card-space';
import MerchantInfoQueries from '../../queries/merchant-info';
import shortUUID from 'short-uuid';

class StubAuthenticationUtils {
  validateAuthToken(encryptedAuthToken: string) {
    return handleValidateAuthToken(encryptedAuthToken);
  }
}

let stubUserAddress = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';
function handleValidateAuthToken(encryptedString: string) {
  expect(encryptedString).to.equal('abc123--def456--ghi789');
  return stubUserAddress;
}

describe('POST /api/profile-purchases', function () {
  this.beforeEach(function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);
  });

  let { request, getContainer } = setupHub(this);
  let merchantInfosQueries: MerchantInfoQueries, cardSpacesQueries: CardSpaceQueries;

  this.beforeEach(async function () {
    merchantInfosQueries = await getContainer().lookup('merchant-info', { type: 'query' });
    cardSpacesQueries = await getContainer().lookup('card-space', { type: 'query' });
  });

  it('persists merchant information', async function () {
    let merchantId;

    await request()
      .post(`/api/profile-purchases`)
      .send({
        data: {
          type: 'profile-purchases',
        },
        relationships: {
          'merchant-info': {
            data: {
              type: 'merchant-infos',
              lid: '1',
            },
          },
        },
        included: [
          {
            type: 'merchant-infos',
            lid: '1',
            attributes: {
              name: 'Satoshi Nakamoto',
              slug: 'satoshi',
              color: 'ff0000',
              'text-color': 'ffffff',
            },
          },
        ],
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(201)
      .expect('Content-Type', 'application/vnd.api+json')
      .expect(function (res) {
        merchantId = res.body.data.id;
      });

    let merchantRecord = (await merchantInfosQueries.fetch({ id: merchantId }))[0];
    expect(merchantRecord.name).to.equal('Satoshi Nakamoto');
    expect(merchantRecord.slug).to.equal('satoshi');
    expect(merchantRecord.color).to.equal('ff0000');
    expect(merchantRecord.textColor).to.equal('ffffff');

    let cardSpaceRecord = (await cardSpacesQueries.query({ merchantId }))[0];
    expect(cardSpaceRecord).to.exist;
  });

  it('returns 401 without bearer token', async function () {
    await request()
      .post(`/api/profile-purchases`)
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

  it('rejects a slug with an invalid character', async function () {
    await request()
      .post(`/api/profile-purchases`)
      .send({
        data: {
          type: 'profile-purchases',
        },
        relationships: {
          'merchant-info': {
            data: {
              type: 'merchant-infos',
              lid: '1',
            },
          },
        },
        included: [
          {
            type: 'merchant-infos',
            lid: '1',
            attributes: {
              name: 'Satoshi Nakamoto',
              slug: 'sat-oshi',
              color: 'ff0000',
              'text-color': 'ffffff',
            },
          },
        ],
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect('Content-Type', 'application/vnd.api+json')
      .expect({
        status: '422',
        title: 'Invalid merchant slug',
        detail: 'Unique ID can only contain lowercase letters or numbers, no special characters',
      });
  });

  it('rejects a slug that is too long', async function () {
    await request()
      .post(`/api/profile-purchases`)
      .send({
        data: {
          type: 'profile-purchases',
        },
        relationships: {
          'merchant-info': {
            data: {
              type: 'merchant-infos',
              lid: '1',
            },
          },
        },
        included: [
          {
            type: 'merchant-infos',
            lid: '1',
            attributes: {
              name: 'Satoshi Nakamoto',
              slug: 'satoshisatoshisatoshisatoshisatoshisatoshisatoshi11',
              color: 'ff0000',
              'text-color': 'ffffff',
            },
          },
        ],
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect('Content-Type', 'application/vnd.api+json')
      .expect({
        status: '422',
        title: 'Invalid merchant slug',
        detail: 'Unique ID cannot be more than 50 characters long. It is currently 51 characters long',
      });
  });

  it('rejects a slug with a forbidden word', async function () {
    await request()
      .post(`/api/profile-purchases`)
      .send({
        data: {
          type: 'profile-purchases',
        },
        relationships: {
          'merchant-info': {
            data: {
              type: 'merchant-infos',
              lid: '1',
            },
          },
        },
        included: [
          {
            type: 'merchant-infos',
            lid: '1',
            attributes: {
              name: 'Satoshi Nakamoto',
              slug: 'cardstack',
              color: 'ff0000',
              'text-color': 'ffffff',
            },
          },
        ],
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect('Content-Type', 'application/vnd.api+json')
      .expect({
        status: '422',
        title: 'Invalid merchant slug',
        detail: 'This ID is not allowed',
      });
  });

  it('rejects a duplicate slug', async function () {
    await merchantInfosQueries.insert({
      id: shortUUID.uuid(),
      name: 'yes',
      slug: 'satoshi',
      color: 'pink',
      textColor: 'black',
      ownerAddress: 'me',
    });

    await request()
      .post(`/api/profile-purchases`)
      .send({
        data: {
          type: 'profile-purchases',
        },
        relationships: {
          'merchant-info': {
            data: {
              type: 'merchant-infos',
              lid: '1',
            },
          },
        },
        included: [
          {
            type: 'merchant-infos',
            lid: '1',
            attributes: {
              name: 'Satoshi Nakamoto',
              slug: 'satoshi',
              color: 'ff0000',
              'text-color': 'ffffff',
            },
          },
        ],
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect('Content-Type', 'application/vnd.api+json')
      .expect({
        status: '422',
        title: 'Invalid merchant slug',
        detail: 'This ID is already taken. Please choose another one',
      });
  });

  it('rejects missing merchant-infos', async function () {
    await request()
      .post(`/api/profile-purchases`)
      .send({
        data: {
          type: 'profile-purchases',
        },
        relationships: {
          'merchant-info': {
            data: {
              type: 'merchant-infos',
              lid: '2',
            },
          },
        },
        included: [
          {
            type: 'merchant-infos',
            lid: '1',
            attributes: {
              name: 'Satoshi Nakamoto',
              slug: 'satoshi',
              color: 'ff0000',
              'text-color': 'ffffff',
            },
          },
        ],
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect('Content-Type', 'application/vnd.api+json')
      .expect({
        status: '422',
        title: 'Missing merchant-infos',
        detail: 'No included merchant-infos with lid 2 was found',
      });

    await request()
      .post(`/api/profile-purchases`)
      .send({
        data: {
          type: 'profile-purchases',
        },
        relationships: {
          'merchant-info': {
            data: {
              type: 'merchant-infos',
              lid: '1',
            },
          },
        },
        included: [
          {
            type: 'what?',
            lid: '1',
            attributes: {
              name: 'Satoshi Nakamoto',
              slug: 'satoshi',
              color: 'ff0000',
              'text-color': 'ffffff',
            },
          },
        ],
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect('Content-Type', 'application/vnd.api+json')
      .expect({
        status: '422',
        title: 'Missing merchant-infos',
        detail: 'No included merchant-infos with lid 1 was found',
      });

    await request()
      .post(`/api/profile-purchases`)
      .send({
        data: {
          type: 'profile-purchases',
        },
        relationships: {
          what: {
            data: {
              type: 'what',
              lid: '1',
            },
          },
        },
      })
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect('Content-Type', 'application/vnd.api+json')
      .expect({
        status: '422',
        title: 'Missing merchant-infos',
        detail: 'merchant-info relationship must be included',
      });
  });
});
