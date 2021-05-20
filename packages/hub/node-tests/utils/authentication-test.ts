import { AuthenticationUtils } from '../../utils/authentication';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('AuthenticationUtils', function () {
  let subject: AuthenticationUtils;

  beforeEach(function () {
    subject = new AuthenticationUtils();
  });

  it('it can generate a nonce', async function () {
    let nonce1 = subject.generateNonce();
    expect(nonce1).to.contain(':');
    await delay(5);
    let nonce2 = subject.generateNonce();
    expect(nonce1).not.to.equal(nonce2);
  });

  it('can extract the timestamp from a valid nonce', function () {
    let nonce1 = subject.generateNonce();
    let timestamp = subject.extractVerifiedTimestamp(nonce1);
    expect(Number(process.hrtime.bigint() - timestamp)).to.be.lessThan(10000000); // within 10ms
  });

  it('throws in the case of an invalid nonce', function () {
    expect(function () {
      subject.extractVerifiedTimestamp('abc:123');
    }).to.throw('Invalid signature');
  });

  it('can generate an encrypted auth token and decrypt it', function () {
    let address = '0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13';
    let ciphertext = subject.buildAuthToken('0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13');
    expect(ciphertext.split('--').length).to.equal(3);
    expect(ciphertext).to.not.include(address);
    let plaintext = subject.decryptAuthToken(ciphertext);
    expect(plaintext).to.match(/current_user_id=0x2f58630CA445Ab1a6DE2Bb9892AA2e1d60876C13&expires_at=/);
  });
});
