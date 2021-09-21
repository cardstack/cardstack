import { Client as DBClient } from 'pg';
import { Server } from 'http';
import supertest, { Test } from 'supertest';
import { bootServerForTesting } from '../../main';
import { Container } from '../../di/dependency-injection';
import { Registry } from '../../di/dependency-injection';

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

let stubUserAddress1 = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';
let stubUserAddress2 = '0xb21851B00bd13C008f703A21DFDd292b28A736b3';

function handleValidateAuthToken(encryptedString: string) {
  switch (encryptedString) {
    case 'abc123--def456--ghi789':
      return stubUserAddress1;
    case 'mno123--pqr456--stu789':
      return stubUserAddress2;
  }
}

describe('POST /api/reservations', function () {
  let server: Server;
  let db: DBClient;
  let request: supertest.SuperTest<Test>;

  this.beforeEach(async function () {
    let container!: Container;

    server = await bootServerForTesting({
      port: 3001,
      registryCallback(registry: Registry) {},
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

  it(`creates a new reservation for an authenticated client when inventory exists`, async function () {});

  it(`creates a new reservation for an authenticated client when there are pending reservations but sufficient inventory still exists `, async function () {});

  it(`creates a new reservation for an authenticated client when the available inventory includes expired reservations`, async function () {});

  it(`returns 401 when client is not authenticated`, async function () {});

  it(`returns 400 when there is no inventory to reserve`, async function () {});

  it(`returns 400 when there is inventory but all the items are already reserved`, async function () {});

  it(`returns 400 when there is no inventory, but subgraph hasn't completed syncing`, async function () {});
});
