import { Client as DBClient } from 'pg';
import { Server } from 'http';
import supertest, { Test } from 'supertest';
import { bootServerForTesting } from '../../main';
import { Container } from '../../di/dependency-injection';
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
}

describe('/api/reservations', function () {
  let server: Server;
  let db: DBClient;
  let request: supertest.SuperTest<Test>;

  this.beforeEach(async function () {
    let container!: Container;

    server = await bootServerForTesting({
      port: 3001,
      registryCallback(registry: Registry) {
        registry.register('authentication-utils', StubAuthenticationUtils);
        registry.register('subgraph', StubSubgraph);
      },
      containerCallback(serverContainer: Container) {
        container = serverContainer;
      },
    });

    let dbManager = await container.lookup('database-manager');
    db = await dbManager.getClient();
    await db.query(`DELETE FROM reservations`);
    await db.query(`DELETE FROM wallet_orders`);

    request = supertest(server);
  });

  this.afterEach(async function () {
    server.close();
  });

  describe('POST', function () {
    it(`creates a new reservation for an authenticated client when inventory exists`, async function () {
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

      const payload = {
        data: {
          type: 'reservations',
          'user-address': stubUserAddress,
          sku: 'sku1',
        },
      };

      let reservationId;

      await request
        .post(`/api/reservations`)
        .send(payload)
        .set('Authorization', 'Bearer: abc123--def456--ghi789')
        .set('Accept', 'application/vnd.api+json')
        .set('Content-Type', 'application/vnd.api+json')
        .expect(201)
        .expect(function (res) {
          reservationId = res.body.data.id;
          res.body.data.id = 'stubId';
        })
        .expect({
          data: {
            id: 'stubId',
            type: 'reservations',
            attributes: {
              'user-address': stubUserAddress,
              sku: 'sku1',
              'transaction-hash': null,
              'prepaid-card-address': null,
            },
          },
        })
        .expect('Content-Type', 'application/vnd.api+json');
    });

    it(`returns 401 when client is not authenticated`, async function () {});

    it(`returns 400 when there is no inventory to reserve`, async function () {});
  });

  describe('GET', function () {
    it(`returns an authenticated client's reservation`, async function () {});

    it(`returns 401 when client is not authenticated`, async function () {});

    // we return 404 so we don't leak the existence of reservations that aren't yours
    it(`returns 404 when authenticated client gets a different user's record`, async function () {});

    it(`returns 404 when authenticated client gets non-existent reservation`, async function () {});
  });
});
