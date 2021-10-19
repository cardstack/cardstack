import { AuthenticationUtils } from '../../utils/authentication';
import { AcceleratableClock, createTestEnv } from '../helpers';
import { Registry } from '@cardstack/di';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('AuthenticationUtils', function () {
  let destroy: () => Promise<void>;

  async function createSubject(registryCallback?: (registry: Registry) => void): Promise<AuthenticationUtils> {
    let container;
    ({ container, destroy } = await createTestEnv(registryCallback));
    return await container.lookup('authentication-utils');
  }

  beforeEach(async function () {});

  afterEach(async function () {
    await destroy();
  });

  describe('nonce generation and validation', function () {
    it('it can generate a nonce', async function () {
      let subject = await createSubject();
      let nonce1 = subject.generateNonce();
      expect(nonce1).to.contain(':');
      await delay(5);
      let nonce2 = subject.generateNonce();
      expect(nonce1).not.to.equal(nonce2);
    });

    it('can extract the timestamp from a valid nonce', async function () {
      let subject = await createSubject();
      let nonce1 = subject.generateNonce();
      let timestamp = subject.extractVerifiedTimestamp(nonce1);
      expect(Number(process.hrtime.bigint() - timestamp)).to.be.lessThan(10000000); // within 10ms
    });

    it('throws in the case of an invalid nonce', async function () {
      let subject = await createSubject();
      expect(function () {
        subject.extractVerifiedTimestamp('abc:123');
      }).to.throw('Invalid signature');
    });
  });

  describe('auth token generation and validation', function () {
    it('can generate an encrypted auth token and decrypt it', async function () {
      let subject = await createSubject();
      let address = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';
      let ciphertext = subject.buildAuthToken('0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13');
      expect(ciphertext.split('--').length).to.equal(3);
      expect(ciphertext).to.not.include(address);
      let plaintext = subject.decryptAuthToken(ciphertext);
      expect(plaintext).to.match(/current_user_id=0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13&expires_at=/);
    });

    it('validateAuthToken with valid token returns user address', async function () {
      let subject = await createSubject();
      let exampleUserAddress = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';
      let authToken = subject.buildAuthToken(exampleUserAddress);
      expect(subject.validateAuthToken(authToken)).to.equal(exampleUserAddress);
    });

    it('validateAuthToken with invalid token throws', async function () {
      let subject = await createSubject();
      let exampleUserAddress = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';
      let authToken = subject.buildAuthToken(exampleUserAddress);

      let ivTamperedAuthToken = `tampering${authToken}`;
      expect(function () {
        subject.validateAuthToken(ivTamperedAuthToken);
      }).to.throw('Invalid IV');

      let ciperTextTamperedAuthToken = authToken
        .split('--')
        .map((part, i) => {
          if (i === 1) {
            part = `tamper${part}`;
          }
          return part;
        })
        .join('--');
      expect(function () {
        subject.validateAuthToken(ciperTextTamperedAuthToken);
      }).to.throw('Unsupported state or unable to authenticate');

      let authTagTamperedAuthToken = authToken
        .split('--')
        .map((part, i) => {
          if (i === 2) {
            part = `tamper${part}`;
          }
          return part;
        })
        .join('--');
      expect(function () {
        subject.validateAuthToken(authTagTamperedAuthToken);
      }).to.throw('Invalid authentication tag length: 0');
    });

    it('validateAuthToken with expired token throws', async function () {
      let subject = await createSubject((registry: Registry) => {
        registry.register('clock', AcceleratableClock);
      });
      let authToken = subject.buildAuthToken('0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13');
      (subject.clock as AcceleratableClock).acceleratedByMs = 1000 * 60 * 60 * 25; // 25 hours
      expect(function () {
        subject.validateAuthToken(authToken);
      }).to.throw('Auth token expired');
    });
  });
});
