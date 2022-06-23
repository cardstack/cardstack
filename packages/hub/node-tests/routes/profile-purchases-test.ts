import { registry, setupHub } from '../helpers/server';
import CardSpaceQueries from '../../queries/card-space';
import MerchantInfoQueries from '../../queries/merchant-info';

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
});
