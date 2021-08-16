import { Server } from 'http';
import supertest, { Test } from 'supertest';
import { Client as DBClient } from 'pg';
import { bootServerForTesting } from '../../main';
import { Container, Registry } from '../../di/dependency-injection';

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

class StubWyreService {
  createCustodialWallet(address: string) {
    return handleCreateWyreWallet(address);
  }
}

let stubUserAddress = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';
let stubWyreWalletId = 'WA_L36QRQZUPCR';
let stubDepositAddress = '0x59faede86fb650d956ca633a5c1a21fa53fe151c'; // wyre always returns lowercase addresses
let wyreCallCount = 0;

function handleValidateAuthToken(encryptedString: string) {
  expect(encryptedString).to.equal('abc123--def456--ghi789');
  return stubUserAddress;
}

function handleCreateWyreWallet(address: string) {
  wyreCallCount++;
  return {
    status: null,
    callbackUrl: null,
    srn: `wallet:${stubWyreWalletId}`,
    pusherChannel: 'blah',
    notes: null,
    balances: {},
    depositAddresses: {
      ETH: stubDepositAddress, // eslint-disable-line @typescript-eslint/naming-convention
    },
    totalBalances: {},
    availableBalances: {},
    savingsReferralSRN: null,
    name: address,
    id: stubWyreWalletId,
    type: 'DEFAULT',
  };
}

describe('GET /api/custodial-wallet', function () {
  let server: Server;
  let db: DBClient;
  let request: supertest.SuperTest<Test>;

  this.beforeEach(async function () {
    let container!: Container;
    wyreCallCount = 0;
    server = await bootServerForTesting({
      port: 3001,
      registryCallback(registry: Registry) {
        registry.register('authentication-utils', StubAuthenticationUtils);
        registry.register('wyre', StubWyreService);
      },
      containerCallback(serverContainer: Container) {
        container = serverContainer;
      },
    });
    let dbManager = await container.lookup('database-manager');
    db = await dbManager.getClient();
    await db.query('DELETE FROM custodial_wallets');
    // Add foil test data to assert we never get this result
    await db.query('INSERT INTO custodial_wallets (id, wyre_wallet_id, deposit_address) VALUES ($1, $2, $3)', [
      `foil-${stubUserAddress}`.toLowerCase(),
      `foil-${stubWyreWalletId}`,
      `foil-${stubDepositAddress}`,
    ]);

    request = supertest(server);
  });

  this.afterEach(async function () {
    server.close();
  });

  it('gets a the custodial wallet for an EOA that is not yet assigned a custodial wallet', async function () {
    let numWallets = (await db.query('SELECT * from custodial_wallets')).rowCount;
    await request
      .get(`/api/custodial-wallet`)
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: {
          type: 'custodial-wallets',
          id: stubUserAddress.toLowerCase(),
          attributes: {
            'wyre-wallet-id': stubWyreWalletId,
            'deposit-address': stubDepositAddress,
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');

    expect(wyreCallCount).to.equal(1);

    let results = await db.query('SELECT * from custodial_wallets');
    expect(results.rowCount).to.equal(numWallets + 1);
    results = await db.query('SELECT * from custodial_wallets WHERE id = $1', [stubUserAddress.toLowerCase()]);
    let {
      rows: [row],
    } = results;
    expect(row.id).to.equal(stubUserAddress.toLowerCase());
    expect(row.wyre_wallet_id).to.equal(stubWyreWalletId);
    expect(row.deposit_address).to.equal(stubDepositAddress);
  });

  it('gets the custodial wallet for an EOA that has already been assigned a custodial wallet', async function () {
    await db.query('INSERT INTO custodial_wallets (id, wyre_wallet_id, deposit_address) VALUES ($1, $2, $3)', [
      stubUserAddress.toLowerCase(),
      stubWyreWalletId,
      stubDepositAddress,
    ]);
    let numWallets = (await db.query('SELECT * from custodial_wallets')).rowCount;
    await request
      .get(`/api/custodial-wallet`)
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: {
          type: 'custodial-wallets',
          id: stubUserAddress.toLowerCase(),
          attributes: {
            'wyre-wallet-id': stubWyreWalletId,
            'deposit-address': stubDepositAddress,
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');

    expect(wyreCallCount).to.equal(0);

    let results = await db.query('SELECT * from custodial_wallets');
    expect(results.rowCount).to.equal(numWallets);
  });

  it('returns 401 without bearer token', async function () {
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
