import { Client as DBClient } from 'pg';
import supertest, { Test } from 'supertest';
import { HubServer } from '../../main';
import { Registry } from '../../di/dependency-injection';
import { InventorySubgraph } from '../../services/subgraph';
import { makeInventoryData } from '../helpers';
import Web3 from 'web3';

const { toWei } = Web3.utils;
const stubNonce = 'abc:123';
let stubAuthToken = 'def--456';
let stubTimestamp = process.hrtime.bigint();
let stubInventorySubgraph: () => InventorySubgraph;

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

class StubSubgraph {
  async getInventory(reservedPrepaidCards: string[]): Promise<InventorySubgraph> {
    let result = stubInventorySubgraph();
    // this replicates the subgraph's where clause for reserved cards
    for (let inventory of result.data.skuinventories) {
      inventory.prepaidCards = inventory.prepaidCards.filter((p) => !reservedPrepaidCards.includes(p.prepaidCardId));
    }
    return Promise.resolve(result);
  }
}

let stubUserAddress = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';

function handleValidateAuthToken(encryptedString: string) {
  if (encryptedString === 'abc123--def456--ghi789') {
    return stubUserAddress;
  }
  return;
}

describe('GET /api/inventory', function () {
  let server: HubServer;
  let db: DBClient;
  let request: supertest.SuperTest<Test>;

  this.beforeEach(async function () {
    server = await HubServer.create({
      port: 3001,
      registryCallback(registry: Registry) {
        registry.register('authentication-utils', StubAuthenticationUtils);
        registry.register('subgraph', StubSubgraph);
      },
    });

    let dbManager = await server.container.lookup('database-manager');
    db = await dbManager.getClient();
    await db.query(`DELETE FROM reservations`);
    await db.query(`DELETE FROM wallet_orders`);

    request = supertest(server.app.callback());
  });

  this.afterEach(async function () {
    server.teardown();
  });

  it(`retrieves inventory for an authenticated client for all SKUs`, async function () {
    stubInventorySubgraph = () => ({
      data: {
        skuinventories: [
          makeInventoryData('sku1', '100', toWei('1'), [
            '0x024db5796C3CaAB34e9c0995A1DF17A91EECA6cC',
            '0x04699Ff48CC6531727A12344c30F3eD1062Ff3ad',
          ]),
          makeInventoryData(
            'sku2',
            '200',
            toWei('2'),
            ['0x483F081bB0C25A5B216D1A4BD9CE0196092A0575'],
            'did:cardstack:test1'
          ),
        ],
      },
    });

    await request
      .get(`/api/inventories`)
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: [
          {
            type: 'inventories',
            id: 'sku1',
            attributes: {
              issuer: '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              sku: 'sku1',
              'issuing-token-symbol': 'DAI',
              'issuing-token-address': '0xFeDc0c803390bbdA5C4C296776f4b574eC4F30D1',
              'face-value': 100,
              'ask-price': toWei('1'),
              'customization-DID': null,
              quantity: 2,
            },
          },
          {
            type: 'inventories',
            id: 'sku2',
            attributes: {
              issuer: '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              sku: 'sku2',
              'issuing-token-symbol': 'DAI',
              'issuing-token-address': '0xFeDc0c803390bbdA5C4C296776f4b574eC4F30D1',
              'face-value': 200,
              'ask-price': toWei('2'),
              'customization-DID': 'did:cardstack:test1',
              quantity: 1,
            },
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it(`does not include pending reservations in the inventory count`, async function () {
    let prepaidCard1 = '0x024db5796C3CaAB34e9c0995A1DF17A91EECA6cC';
    let prepaidCard2 = '0x04699Ff48CC6531727A12344c30F3eD1062Ff3ad';
    await db.query(`INSERT INTO reservations (user_address, sku) VALUES ($1, $2)`, [stubUserAddress, 'sku1']);
    stubInventorySubgraph = () => ({
      data: {
        skuinventories: [makeInventoryData('sku1', '100', toWei('1'), [prepaidCard1, prepaidCard2])],
      },
    });
    await request
      .get(`/api/inventories`)
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: [
          {
            type: 'inventories',
            id: 'sku1',
            attributes: {
              issuer: '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              sku: 'sku1',
              'issuing-token-symbol': 'DAI',
              'issuing-token-address': '0xFeDc0c803390bbdA5C4C296776f4b574eC4F30D1',
              'face-value': 100,
              'ask-price': toWei('1'),
              'customization-DID': null,
              quantity: 1,
            },
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it(`does includes expired reservations in the inventory count`, async function () {
    let prepaidCard1 = '0x024db5796C3CaAB34e9c0995A1DF17A91EECA6cC';
    let prepaidCard2 = '0x04699Ff48CC6531727A12344c30F3eD1062Ff3ad';
    await db.query(
      `INSERT INTO reservations (user_address, sku, updated_at) VALUES ($1, $2, now() - interval '10 minutes')`,
      [stubUserAddress, 'sku1']
    );
    await db.query(
      `INSERT INTO reservations (user_address, sku, updated_at) VALUES ($1, $2, now() - interval '61 minutes')`,
      [stubUserAddress, 'sku1']
    );
    stubInventorySubgraph = () => ({
      data: {
        skuinventories: [makeInventoryData('sku1', '100', toWei('1'), [prepaidCard1, prepaidCard2])],
      },
    });

    await request
      .get(`/api/inventories`)
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: [
          {
            type: 'inventories',
            id: 'sku1',
            attributes: {
              issuer: '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              sku: 'sku1',
              'issuing-token-symbol': 'DAI',
              'issuing-token-address': '0xFeDc0c803390bbdA5C4C296776f4b574eC4F30D1',
              'face-value': 100,
              'ask-price': toWei('1'),
              'customization-DID': null,
              quantity: 1,
            },
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it(`does not include recently provisioned prepaid cards in the inventory count when the subgraph has not synced yet`, async function () {
    let prepaidCard1 = '0x024db5796C3CaAB34e9c0995A1DF17A91EECA6cC';
    let prepaidCard2 = '0x04699Ff48CC6531727A12344c30F3eD1062Ff3ad';
    await db.query(`INSERT INTO reservations (user_address, sku, prepaid_card_address) VALUES ($1, $2, $3)`, [
      stubUserAddress,
      'sku1',
      prepaidCard1,
    ]);
    stubInventorySubgraph = () => ({
      data: {
        // in this scenario, the provisioned prepaid card still appears in the subgraph inventory
        skuinventories: [makeInventoryData('sku1', '100', toWei('1'), [prepaidCard1, prepaidCard2])],
      },
    });
  });

  it(`can reflect no inventory available`, async function () {
    let prepaidCard1 = '0x024db5796C3CaAB34e9c0995A1DF17A91EECA6cC';
    await db.query(`INSERT INTO reservations (user_address, sku) VALUES ($1, $2)`, [stubUserAddress, 'sku1']);
    stubInventorySubgraph = () => ({
      data: {
        skuinventories: [
          makeInventoryData('sku1', '100', toWei('1'), [prepaidCard1]),
          makeInventoryData('sku2', '200', toWei('2'), []),
        ],
      },
    });
    await request
      .get(`/api/inventories`)
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: [
          {
            type: 'inventories',
            id: 'sku1',
            attributes: {
              issuer: '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              sku: 'sku1',
              'issuing-token-symbol': 'DAI',
              'issuing-token-address': '0xFeDc0c803390bbdA5C4C296776f4b574eC4F30D1',
              'face-value': 100,
              'ask-price': toWei('1'),
              'customization-DID': null,
              quantity: 0,
            },
          },
          {
            type: 'inventories',
            id: 'sku2',
            attributes: {
              issuer: '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
              sku: 'sku2',
              'issuing-token-symbol': 'DAI',
              'issuing-token-address': '0xFeDc0c803390bbdA5C4C296776f4b574eC4F30D1',
              'face-value': 200,
              'ask-price': toWei('2'),
              'customization-DID': null,
              quantity: 0,
            },
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it(`returns 401 when client is not authenticated`, async function () {
    stubInventorySubgraph = () => ({
      data: {
        skuinventories: [
          makeInventoryData('sku1', '100', toWei('1'), [
            '0x024db5796C3CaAB34e9c0995A1DF17A91EECA6cC',
            '0x04699Ff48CC6531727A12344c30F3eD1062Ff3ad',
          ]),
        ],
      },
    });
    await request
      .get('/api/custodial-wallet')
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
