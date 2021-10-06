import { Registry } from '../../di/dependency-injection';
import Web3 from 'web3';
import { setupServer } from '../helpers/server';

const { toChecksumAddress } = Web3.utils;
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
  createWallet(address: string) {
    return Promise.resolve(handleCreateWyreWallet(address));
  }
  getWalletByUserAddress(userAddress: string) {
    return Promise.resolve(handleGetWyreWalletByName(userAddress));
  }
}

let stubUserAddress1 = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';
let stubWyreWalletId1 = 'WA_L36QRQZUPCR';
let stubDepositAddress1 = '0x59faede86fb650d956ca633a5c1a21fa53fe151c'; // wyre always returns lowercase addresses

let stubUserAddress2 = '0xb21851B00bd13C008f703A21DFDd292b28A736b3';
let stubWyreWalletId2 = 'WA_TWTJ9QQZV9R';
let stubDepositAddress2 = '0x59faede86fb650d956ca633a5c1a21fa53fe151c'; // wyre always returns lowercase addresses

let wyreCreateCallCount = 0;

function handleValidateAuthToken(encryptedString: string) {
  switch (encryptedString) {
    case 'abc123--def456--ghi789':
      return stubUserAddress1;
    case 'mno123--pqr456--stu789':
      return stubUserAddress2;
    default:
      return undefined;
  }
}

function handleCreateWyreWallet(address: string) {
  wyreCreateCallCount++;
  expect(address).to.equal(stubUserAddress1);
  return {
    callbackUrl: null,
    depositAddresses: {
      ETH: stubDepositAddress1, // eslint-disable-line @typescript-eslint/naming-convention
    },
    name: address.toLowerCase(),
    id: stubWyreWalletId1,
  };
}

function handleGetWyreWalletByName(address: string) {
  if (address === stubUserAddress2) {
    return {
      status: null,
      callbackUrl: null,
      srn: `wallet:${stubWyreWalletId2}`,
      pusherChannel: 'blah',
      notes: null,
      balances: {},
      depositAddresses: {
        ETH: stubDepositAddress2, // eslint-disable-line @typescript-eslint/naming-convention
      },
      totalBalances: {},
      availableBalances: {},
      savingsReferralSRN: null,
      name: address.toLowerCase(),
      id: stubWyreWalletId2,
      type: 'DEFAULT',
    };
  }
  return;
}

describe('GET /api/custodial-wallet', function () {
  let { request } = setupServer(this, {
    registryCallback(registry: Registry) {
      registry.register('authentication-utils', StubAuthenticationUtils);
      registry.register('wyre', StubWyreService);
    },
  });

  this.beforeEach(async function () {
    wyreCreateCallCount = 0;
  });

  it('gets a the custodial wallet for an EOA that is not yet assigned a custodial wallet', async function () {
    await request()
      .get(`/api/custodial-wallet`)
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: {
          type: 'custodial-wallets',
          id: stubUserAddress1,
          attributes: {
            'wyre-wallet-id': stubWyreWalletId1,
            'user-address': stubUserAddress1,
            'deposit-address': toChecksumAddress(stubDepositAddress1),
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');

    expect(wyreCreateCallCount).to.equal(1);
  });

  it('gets the custodial wallet for an EOA that has already been assigned a custodial wallet', async function () {
    await request()
      .get(`/api/custodial-wallet`)
      .set('Authorization', 'Bearer: mno123--pqr456--stu789')
      .set('Accept', 'application/vnd.api+json')
      .set('Content-Type', 'application/vnd.api+json')
      .expect(200)
      .expect({
        data: {
          type: 'custodial-wallets',
          id: stubUserAddress2,
          attributes: {
            'wyre-wallet-id': stubWyreWalletId2,
            'user-address': stubUserAddress2,
            'deposit-address': toChecksumAddress(stubDepositAddress2),
          },
        },
      })
      .expect('Content-Type', 'application/vnd.api+json');

    expect(wyreCreateCallCount).to.equal(0);
  });

  it('returns 401 without bearer token', async function () {
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
