import { Client as DBClient } from 'pg';
import { InventorySubgraph } from '../../services/subgraph';
import { makeInventoryData } from '../helpers';
import Web3 from 'web3';
import { registry, setupHub } from '../helpers/server';

const { toWei } = Web3.utils;
const stubNonce = 'abc:123';
let stubAuthToken = 'def--456';
let stubTimestamp = process.hrtime.bigint();
let stubWeb3Available = true;
let stubRelayAvailable = true;
let stubInventorySubgraph: () => InventorySubgraph;
let defaultContractMethods = {
  cardpayVersion() {
    return {
      async call() {
        return Promise.resolve('any');
      },
    };
  },
};
let contractPauseMethod = (isPaused: boolean) => ({
  paused() {
    return {
      async call() {
        return Promise.resolve(isPaused);
      },
    };
  },
});
let stubMarketContract: () => any;

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
  async getInventory(reservedPrepaidCards: string[], issuer?: string | undefined): Promise<InventorySubgraph> {
    let result = stubInventorySubgraph();
    // this replicates the subgraph's where clause for issuer
    if (issuer) {
      result = {
        data: {
          skuinventories: (result.data.skuinventories = result.data.skuinventories.filter(
            (i) => i.sku.issuer.id === issuer
          )),
        },
      };
    }

    // this replicates the subgraph's where clause for reserved cards
    for (let inventory of result.data.skuinventories) {
      inventory.prepaidCards = inventory.prepaidCards.filter((p) => !reservedPrepaidCards.includes(p.prepaidCardId));
    }
    return Promise.resolve(result);
  }
}

class StubWeb3 {
  isAvailable() {
    return Promise.resolve(stubWeb3Available);
  }
  getInstance() {
    return {
      eth: {
        net: {
          getId() {
            return 77; // sokol network id
          },
        },
        Contract: class {
          get methods() {
            return stubMarketContract();
          }
        },
      },
    };
  }
}

class StubRelay {
  isAvailable() {
    return Promise.resolve(stubRelayAvailable);
  }
}

let stubUserAddress = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';
let stubIssuer = '0xb21851B00bd13C008f703A21DFDd292b28A736b3';

function handleValidateAuthToken(encryptedString: string) {
  if (encryptedString === 'abc123--def456--ghi789') {
    return stubUserAddress;
  }
  return;
}

describe('GET /api/inventory', function () {
  let db: DBClient;

  this.beforeEach(function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);
    registry(this).register('subgraph', StubSubgraph);
    registry(this).register('web3-http', StubWeb3);
    registry(this).register('relay', StubRelay);
  });

  let { getContainer, request } = setupHub(this);

  this.beforeEach(async function () {
    let dbManager = await getContainer().lookup('database-manager');
    db = await dbManager.getClient();
    await db.query(`DELETE FROM reservations`);
    await db.query(`DELETE FROM wallet_orders`);

    stubMarketContract = () => ({
      ...defaultContractMethods,
      ...contractPauseMethod(false),
    });
    stubRelayAvailable = true;
    stubWeb3Available = true;
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

    await request()
      .get(`/api/inventories`)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
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
              reloadable: false,
              transferrable: false,
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
              reloadable: false,
              transferrable: false,
              quantity: 1,
            },
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it(`does not return inventory when contract paused`, async function () {
    stubMarketContract = () => ({
      ...defaultContractMethods,
      ...contractPauseMethod(true),
    });

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

    await request()
      .get(`/api/inventories`)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
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
              reloadable: false,
              transferrable: false,
              quantity: 0,
            },
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it(`does not return inventory when RPC node is unavailable`, async function () {
    stubWeb3Available = false;
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

    await request()
      .get(`/api/inventories`)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
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
              reloadable: false,
              transferrable: false,
              quantity: 0,
            },
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it(`does not return inventory when relay server is unavailable`, async function () {
    stubRelayAvailable = false;
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

    await request()
      .get(`/api/inventories`)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
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
              reloadable: false,
              transferrable: false,
              quantity: 0,
            },
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it(`can filter inventory by issuer`, async function () {
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
            'did:cardstack:test1',
            stubIssuer
          ),
        ],
      },
    });

    await request()
      .get(`/api/inventories?filter[issuer]=${stubIssuer}`)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: [
          {
            type: 'inventories',
            id: 'sku2',
            attributes: {
              issuer: stubIssuer,
              sku: 'sku2',
              'issuing-token-symbol': 'DAI',
              'issuing-token-address': '0xFeDc0c803390bbdA5C4C296776f4b574eC4F30D1',
              'face-value': 200,
              'ask-price': toWei('2'),
              'customization-DID': 'did:cardstack:test1',
              reloadable: false,
              transferrable: false,
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
    await request()
      .get(`/api/inventories`)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
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
              reloadable: false,
              transferrable: false,
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

    await request()
      .get(`/api/inventories`)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
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
              reloadable: false,
              transferrable: false,
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
    await request()
      .get(`/api/inventories`)
      .set('Authorization', 'Bearer abc123--def456--ghi789')
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
              reloadable: false,
              transferrable: false,
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
              reloadable: false,
              transferrable: false,
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
    await request()
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
