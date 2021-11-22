import packageJson from '../../package.json';
import { AcceleratableClock } from '../helpers';
import { registry, setupHub } from '../helpers/server';

const stubNonce = 'abc:123';
let stubAuthToken = 'def--456';
let stubTimestamp = process.hrtime.bigint();

let handleValidateAuthToken = function (_encryptedAuthToken: string) {
  return '';
};

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

let stubNonceUsed = false;
let recentlyUsedNonce: string;
class StubNonceTracker {
  async wasRecentlyUsed(_nonce: string): Promise<boolean> {
    return Promise.resolve(stubNonceUsed);
  }
  async markRecentlyUsed(nonce: string): Promise<void> {
    recentlyUsedNonce = nonce;
    return Promise.resolve();
  }
}

describe('GET /api/session', function () {
  this.beforeEach(function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);
  });

  let { request } = setupHub(this);

  it('without bearer token, responds with 401 and nonce in JSON', async function () {
    await request()
      .get('/api/session')
      .set('Accept', 'application/vnd.api+json')
      .expect(401)
      .expect({
        errors: [
          {
            status: '401',
            title: 'No valid auth token',
            meta: {
              nonce: stubNonce,
              version: packageJson.version,
            },
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('with bearer token, responds with 200 and current owner address', async function () {
    let stubUserAddress = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';
    handleValidateAuthToken = function (encryptedString: string) {
      expect(encryptedString).to.equal('abc123--def456--ghi789');
      return stubUserAddress;
    };
    await request()
      .get('/api/session')
      .set('Accept', 'application/vnd.api+json')
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .expect(200)
      .expect({ data: { attributes: { user: stubUserAddress } } })
      .expect('Content-Type', 'application/vnd.api+json');
  });

  it('with invalid (or expired) bearer token', async function () {
    handleValidateAuthToken = function (encryptedString: string) {
      expect(encryptedString).to.equal('abc123--def456--ghi789');
      throw new Error('Invalid auth token');
    };
    await request()
      .get('/api/session')
      .set('Accept', 'application/vnd.api+json')
      .set('Authorization', 'Bearer abc123--def456--ghi789')
      .expect(401)
      .expect({
        errors: [
          {
            status: '401',
            title: 'No valid auth token',
            meta: {
              nonce: stubNonce,
              version: packageJson.version,
            },
          },
        ],
      })
      .expect('Content-Type', 'application/vnd.api+json');
  });
});

describe('POST /api/session', function () {
  let bodyWithCorrectSignature: any;

  this.beforeEach(function () {
    registry(this).register('authentication-utils', StubAuthenticationUtils);
    registry(this).register('clock', AcceleratableClock);
    registry(this).register('nonce-tracker', StubNonceTracker);
  });

  let { request } = setupHub(this);

  this.beforeEach(async function () {
    bodyWithCorrectSignature = {
      authData: {
        types: {
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
          ],
          Authentication: [
            { name: 'user', type: 'address' },
            { name: 'nonce', type: 'string' },
          ],
        },
        domain: { name: '0.0.0.0:3000', version: '0.0.1', chainId: '77' },
        primaryType: 'Authentication',
        message: {
          user: '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13',
          nonce: 'ODA0MzUzMjU5NzQ1MQ==:9cc7a4c25d3f25a46141706f564e989ce527e2da320f4047725c6cf8eae5bc21',
        },
      },
      signature:
        '0x056e702ba987062b4cdf6f6e0cf6c4187d6820faceec114f9c9d36fac23e091166f3c8a2eaef6644465c11ec294c75417845cf07fd3e965de0ce33ac8a64ae811b',
    };
  });

  this.afterEach(function () {
    stubTimestamp = process.hrtime.bigint();
  });

  it('responds with auth token when signature is correct, and retires nonce', async function () {
    await request()
      .post('/api/session')
      .send({
        data: {
          attributes: bodyWithCorrectSignature,
        },
      })
      .set('Content-Type', 'application/vnd.api+json')
      .set('Accept', 'application/vnd.api+json')
      .expect(200)
      .expect('Content-Type', /json/)
      .expect({
        data: {
          attributes: {
            authToken: stubAuthToken,
          },
        },
      });
    expect(recentlyUsedNonce).to.equal(bodyWithCorrectSignature.authData.message.nonce);
  });

  it('responds with 401 when signature invalid', async function () {
    let bodyWithIncorrectSignature = bodyWithCorrectSignature;
    bodyWithIncorrectSignature.signature = bodyWithCorrectSignature.signature.replace('a', '1').replace('b', '2');
    await request()
      .post('/api/session')
      .send({
        data: {
          attributes: bodyWithIncorrectSignature,
        },
      })
      .set('Content-Type', 'application/vnd.api+json')
      .set('Accept', 'application/vnd.api+json')
      .expect(401)
      .expect('Content-Type', /json/)
      .expect({
        errors: [
          {
            status: '401',
            title: 'Invalid signature',
            detail: 'Signature not verified for specified address',
          },
        ],
      });
  });

  it('responds with 401 when nonce is more than 5 minutes old', async function () {
    stubTimestamp = process.hrtime.bigint() - BigInt(1000000 * 1000 * 60 * 6); // 6 minutes ago
    await request()
      .post('/api/session')
      .send({
        data: {
          attributes: bodyWithCorrectSignature,
        },
      })
      .set('Content-Type', 'application/vnd.api+json')
      .set('Accept', 'application/vnd.api+json')
      .expect(401)
      .expect('Content-Type', /json/)
      .expect({
        errors: [
          {
            status: '401',
            title: 'Invalid signature',
            detail: 'Expired nonce',
          },
        ],
      });
  });

  it('responds with 401 when nonce has already been used', async function () {
    stubNonceUsed = true;
    await request()
      .post('/api/session')
      .send({
        data: {
          attributes: bodyWithCorrectSignature,
        },
      })
      .set('Content-Type', 'application/vnd.api+json')
      .set('Accept', 'application/vnd.api+json')
      .expect(401)
      .expect('Content-Type', /json/)
      .expect({
        errors: [
          {
            status: '401',
            title: 'Invalid signature',
            detail: 'Nonce already used',
          },
        ],
      });
  });
});
