import shortUuid from 'short-uuid';
import { parseIdentifier } from '@cardstack/did-resolver';
import { registry, setupHub } from '../helpers/server';
import { setupStubWorkerClient } from '../helpers/stub-worker-client';
import { ExtendedPrismaClient } from '../../services/prisma-manager';

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

describe('POST /api/prepaid-card-customizations', function () {
  let prismaClient: ExtendedPrismaClient;
  let validPayload: any;

  let { getJobIdentifiers, getJobPayloads } = setupStubWorkerClient(this);

  this.beforeEach(function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);
  });

  let { getContainer, request } = setupHub(this);

  this.beforeEach(async function () {
    prismaClient = await (await getContainer().lookup('prisma-manager')).getClient();

    await prismaClient.prepaidCardPattern.createMany({
      data: [
        {
          id: 'AB70B8D5-95F5-4C20-997C-4DB9013B347C',
          patternUrl: 'https://example.com/a.svg',
          description: 'Pattern A',
        },
        {
          id: 'D2E94EA2-8124-44D8-B495-D3CF33D4C2A4',
          patternUrl: 'https://example.com/b.svg',
          description: 'Pattern B',
        },
      ],
    });

    await prismaClient.prepaidCardColorScheme.createMany({
      data: [
        {
          id: 'C169F7FE-D83C-426C-805E-DF1D695C30F1',
          background: '#efefef',
          patternColor: 'black',
          textColor: 'black',
          description: 'Solid Gray',
        },
        {
          id: '5058B874-CE21-4FC4-958C-B6641E1DC175',
          background: 'linear-gradient(139.27deg, #ff5050 16%, #ac00ff 100%)',
          patternColor: 'white',
          textColor: 'white',
          description: 'Awesome Gradient',
        },
      ],
    });

    validPayload = {
      data: {
        type: 'prepaid-card-customizations',
        attributes: {
          'issuer-name': 'Satoshi Nakamoto',
        },
        relationships: {
          'color-scheme': {
            data: {
              type: 'prepaid-card-color-schemes',
              id: '5058b874-ce21-4fc4-958c-b6641e1dc175',
            },
          },
          pattern: {
            data: {
              type: 'prepaid-card-patterns',
              id: 'ab70b8d5-95f5-4c20-997c-4db9013b347c',
            },
          },
        },
      },
    };
  });

  it('without bearer token, in returns a 401', async function () {
    await request()
      .post('/api/prepaid-card-customizations')
      .send(validPayload)
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

  it('with missing attributes, in returns a 422', async function () {
    let payload = validPayload;
    delete payload.data.attributes['issuer-name'];
    delete payload.data.relationships['color-scheme'];
    await request()
      .post('/api/prepaid-card-customizations')
      .send(payload)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect('Content-Type', 'application/vnd.api+json')
      .expect({
        errors: [
          {
            status: '422',
            title: 'Missing required attribute: issuer-name',
            detail: 'Required field issuer-name was not provided',
          },
          {
            status: '422',
            title: 'Missing required relationship: color-scheme',
            detail: 'Required relationship color-scheme was not provided',
          },
        ],
      });
  });

  it('with invalid attributes, in returns a 422', async function () {
    let payload = validPayload;
    payload.data.attributes['issuer-name'] = '';
    payload.data.relationships['pattern'].data = null;
    await request()
      .post('/api/prepaid-card-customizations')
      .send(payload)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect('Content-Type', 'application/vnd.api+json')
      .expect({
        errors: [
          {
            status: '422',
            title: 'Missing required attribute: issuer-name',
            detail: 'Required field issuer-name was not provided',
          },
          {
            status: '422',
            title: 'Missing required relationship: pattern',
            detail: 'Required relationship pattern was not provided',
          },
        ],
      });
  });

  it('with invalid relationship, in returns a 422', async function () {
    let payload = validPayload;
    payload.data.relationships['color-scheme'].data.id = 'EE1DF59B-1B1F-48C4-876B-CD62BF690A76';
    await request()
      .post('/api/prepaid-card-customizations')
      .send(payload)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(422)
      .expect('Content-Type', 'application/vnd.api+json')
      .expect({
        errors: [
          {
            status: '422',
            title: 'Invalid relationship: color-scheme',
            detail: 'Provided ID for color-scheme relationship was not valid: EE1DF59B-1B1F-48C4-876B-CD62BF690A76',
          },
        ],
      });
  });

  it('responds with 201 and new resource', async function () {
    let resourceId: string;
    let actualDid: string;
    await request()
      .post('/api/prepaid-card-customizations')
      .send(validPayload)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(201)
      .expect(function (res) {
        resourceId = res.body.data.id;
        actualDid = res.body.data.attributes.did;
        res.body.data.id = 'the-id';
        res.body.data.attributes.did = 'the-did';
      })
      .expect({
        meta: {
          network: 'sokol',
        },
        data: {
          type: 'prepaid-card-customizations',
          id: 'the-id',
          attributes: {
            did: 'the-did',
            'issuer-name': 'Satoshi Nakamoto',
            'owner-address': stubUserAddress,
          },
          relationships: {
            pattern: {
              data: {
                type: 'prepaid-card-patterns',
                id: 'ab70b8d5-95f5-4c20-997c-4db9013b347c',
              },
            },
            'color-scheme': {
              data: {
                type: 'prepaid-card-color-schemes',
                id: '5058b874-ce21-4fc4-958c-b6641e1dc175',
              },
            },
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');

    let result = await prismaClient.prepaidCardCustomization.findMany({ where: { id: resourceId! } });
    expect(result.length).to.eq(1, 'Expected new row in `prepaid_card_customizations` table');
    expect(result[0].issuerName).to.eq('Satoshi Nakamoto');
    expect(result[0].ownerAddress).to.eq(stubUserAddress);
    expect(result[0].patternId).to.eq('ab70b8d5-95f5-4c20-997c-4db9013b347c');
    expect(result[0].colorSchemeId).to.eq('5058b874-ce21-4fc4-958c-b6641e1dc175');
    expect(result[0].createdAt).to.be.a('date');

    expect(actualDid!).to.be.a('string');
    let parts = actualDid!.split(':');
    expect(parts[0]).to.eq('did');
    expect(parts[1]).to.eq('cardstack');
    let parsed = parseIdentifier(parts[2]);
    expect(parsed.type).to.eq('PrepaidCardCustomization');
    expect(parsed.version).to.eq(1);
    expect(parsed.uniqueId).to.eq(shortUuid().fromUUID(resourceId!));

    // expect a persist-off-chain-prepaid-card-customization task to be queued
    expect(getJobIdentifiers()[0]).to.equal('persist-off-chain-prepaid-card-customization');
    expect(getJobPayloads()[0]).to.deep.equal({ id: resourceId! });
  });
});
