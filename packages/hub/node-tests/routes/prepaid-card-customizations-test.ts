import { Client } from 'pg';
import shortUuid from 'short-uuid';
import { Registry } from '@cardstack/di';
import { parseIdentifier } from '@cardstack/did-resolver';
import { Job, TaskSpec } from 'graphile-worker';
import { setupServer } from '../helpers/server';

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

let lastAddedJobIdentifier: string | undefined;
let lastAddedJobPayload: any | undefined;

class StubWorkerClient {
  async addJob(identifier: string, payload?: any, _spec?: TaskSpec): Promise<Job> {
    lastAddedJobIdentifier = identifier;
    lastAddedJobPayload = payload;
    return Promise.resolve({} as Job);
  }
}

let stubUserAddress = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';
function handleValidateAuthToken(encryptedString: string) {
  expect(encryptedString).to.equal('abc123--def456--ghi789');
  return stubUserAddress;
}

describe('POST /api/prepaid-card-customizations', function () {
  let db: Client;
  let validPayload: any;

  let { getServer, request } = setupServer(this, {
    registryCallback(registry: Registry) {
      registry.register('authentication-utils', StubAuthenticationUtils);
      registry.register('worker-client', StubWorkerClient);
    },
  });

  this.beforeEach(async function () {
    let dbManager = await getServer().container.lookup('database-manager');
    db = await dbManager.getClient();

    let rows = [
      ['AB70B8D5-95F5-4C20-997C-4DB9013B347C', 'https://example.com/a.svg', 'Pattern A'],
      ['D2E94EA2-8124-44D8-B495-D3CF33D4C2A4', 'https://example.com/b.svg', 'Pattern B'],
    ];
    for (const row of rows) {
      try {
        await db.query('INSERT INTO prepaid_card_patterns(id, pattern_url, description) VALUES($1, $2, $3)', row);
      } catch (e) {
        console.error(e);
      }
    }
    rows = [
      ['C169F7FE-D83C-426C-805E-DF1D695C30F1', '#efefef', 'black', 'black', 'Solid Gray'],
      [
        '5058B874-CE21-4FC4-958C-B6641E1DC175',
        'linear-gradient(139.27deg, #ff5050 16%, #ac00ff 100%)',
        'white',
        'white',
        'Awesome Gradient',
      ],
    ];
    for (const row of rows) {
      try {
        await db.query(
          'INSERT INTO prepaid_card_color_schemes(id, background, pattern_color, text_color, description) VALUES($1, $2, $3, $4, $5)',
          row
        );
      } catch (e) {
        console.error(e);
      }
    }
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

  this.afterEach(async function () {
    lastAddedJobIdentifier = undefined;
    lastAddedJobPayload = undefined;
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
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
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
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
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
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
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

  it('responds with 200 and new resource', async function () {
    let resourceId: string;
    let actualDid: string;
    await request()
      .post('/api/prepaid-card-customizations')
      .send(validPayload)
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
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

    let result = await db.query('SELECT * FROM prepaid_card_customizations WHERE id = $1', [resourceId!]);
    expect(result.rows.length).to.eq(1, 'Expected new row in `prepaid_card_customizations` table');
    expect(result.rows[0]['issuer_name']).to.eq('Satoshi Nakamoto');
    expect(result.rows[0]['owner_address']).to.eq(stubUserAddress);
    expect(result.rows[0]['pattern_id']).to.eq('ab70b8d5-95f5-4c20-997c-4db9013b347c');
    expect(result.rows[0]['color_scheme_id']).to.eq('5058b874-ce21-4fc4-958c-b6641e1dc175');
    expect(result.rows[0]['created_at']).to.be.a('date');

    expect(actualDid!).to.be.a('string');
    let parts = actualDid!.split(':');
    expect(parts[0]).to.eq('did');
    expect(parts[1]).to.eq('cardstack');
    let parsed = parseIdentifier(parts[2]);
    expect(parsed.type).to.eq('PrepaidCardCustomization');
    expect(parsed.version).to.eq(1);
    expect(parsed.uniqueId).to.eq(shortUuid().fromUUID(resourceId!));

    // expect a persist-off-chain-prepaid-card-customization task to be queued
    expect(lastAddedJobIdentifier).to.equal('persist-off-chain-prepaid-card-customization');
    expect(lastAddedJobPayload).to.deep.equal({ id: resourceId! });
  });
});
