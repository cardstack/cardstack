import { Server } from 'http';
import supertest, { Test } from 'supertest';
import { bootEnvironmentForTesting } from '../../main';
import { Registry } from '../../dependency-injection';
import packageJson from '../../package.json';

const stubNonce = 'abc:123';
let stubAuthToken = 'def--456';
let handleValidateAuthToken = function (encryptedAuthToken: string) {
  return '';
};

class StubAuthenticationUtils {
  generateNonce() {
    return stubNonce;
  }
  buildAuthToken() {
    return stubAuthToken;
  }
  validateAuthToken(encryptedAuthToken: string) {
    return handleValidateAuthToken(encryptedAuthToken);
  }
}
describe('GET /api/session', function () {
  let server: Server;
  let request: supertest.SuperTest<Test>;
  this.beforeEach(async function () {
    server = await bootEnvironmentForTesting({
      port: 3001,
      registryCallback(registry: Registry) {
        registry.register('authentication-utils', StubAuthenticationUtils);
      },
    });
    request = supertest(server);
  });

  this.afterEach(function () {
    server.close();
  });

  it('without bearer token, responds with 401 and nonce in JSON', function (done) {
    request
      .get('/api/session')
      .set('Accept', 'application/vnd.api+json')
      .expect(401)
      .expect({ data: { attributes: { nonce: stubNonce, version: packageJson.version } } })
      .expect('Content-Type', 'application/vnd.api+json', done);
  });

  it('with bearer token, responds with 200 and current owner address', function (done) {
    let stubUserAddress = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';
    handleValidateAuthToken = function (encryptedString: string) {
      expect(encryptedString).to.equal('abc123--def456--ghi789');
      return stubUserAddress;
    };
    request
      .get('/api/session')
      .set('Accept', 'application/vnd.api+json')
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
      .expect(200)
      .expect({ data: { attributes: { user: stubUserAddress } } })
      .expect('Content-Type', 'application/vnd.api+json', done);
  });

  it('with invalid (or expired) bearer token', function (done) {
    handleValidateAuthToken = function (encryptedString: string) {
      expect(encryptedString).to.equal('abc123--def456--ghi789');
      throw new Error('Invalid auth token');
    };
    request
      .get('/api/session')
      .set('Accept', 'application/vnd.api+json')
      .set('Authorization', 'Bearer: abc123--def456--ghi789')
      .expect(401)
      .expect({ data: { attributes: { nonce: stubNonce, version: packageJson.version } } })
      .expect('Content-Type', 'application/vnd.api+json', done);
  });
});

describe('POST /api/session', function () {
  let server: Server;
  let request: supertest.SuperTest<Test>;
  let bodyWithCorrectSignature: any;

  this.beforeEach(async function () {
    server = await bootEnvironmentForTesting({
      port: 3001,
      registryCallback(registry: Registry) {
        registry.register('authentication-utils', StubAuthenticationUtils);
      },
    });
    request = supertest(server);
    bodyWithCorrectSignature = {
      authData: {
        types: {
          //eslint-disable-next-line @typescript-eslint/naming-convention
          EIP712Domain: [
            { name: 'name', type: 'string' },
            { name: 'version', type: 'string' },
            { name: 'chainId', type: 'uint256' },
          ],
          //eslint-disable-next-line @typescript-eslint/naming-convention
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
    server.close();
  });

  it('responds with json when signature is correct', function (done) {
    request
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
      .expect(
        {
          data: {
            attributes: {
              authToken: stubAuthToken,
            },
          },
        },
        done
      );
  });

  // * Server use EC recover function to verify that the signature was signed by the signer.
  // On failure, 401 "Signature not verified"
  it('responds with 401 when signature invalid', function (done) {
    let bodyWithIncorrectSignature = bodyWithCorrectSignature;
    bodyWithIncorrectSignature.signature = bodyWithCorrectSignature.signature.replace('a', '1').replace('b', '2');
    request
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
      .expect({ error: 'Signature not verified' }, done);
  });

  // * Server verifies that nonce is less than 5 minutes old. On failure, 401 "Expired nonce"
  // * Server verifies that nonce is not in redis SET of recently used nonces. On failure, 401 "Nonce already used"
  // * Server retires the nonce by adding it to the redis SET of used nonces (5 minute TTL on items in the set)
  // * Server builds an authorization bearer token:

  //   ```js
  //   let ONE_DAY_MS = 1000 * 60 * 60 * 24;
  //   let timestamp = new Date(Date.now() + ONE_DAY_MS).toISOString();
  //   let token = `current_user_id=${"[signer parameter]"}&expires_at=${timestamp}`;
  //   // It is encrypted with a secret key known only to the server.
  //   encrypt(token, secret);

  // ```
});
