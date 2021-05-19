import { NonceGenerator } from '../../utils/session';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('NonceGenerator', function () {
  let generator: NonceGenerator;

  beforeEach(function () {
    generator = new NonceGenerator();
  });

  it('it can generate a nonce', async function () {
    let nonce1 = generator.generate();
    expect(nonce1).to.contain(':');
    await delay(5);
    let nonce2 = generator.generate();
    expect(nonce1).not.to.equal(nonce2);
  });

  it('can extract the timestamp from a valid nonce', function () {
    let nonce1 = generator.generate();
    let timestamp = generator.extractVerifiedTimestamp(nonce1);
    expect(Number(process.hrtime.bigint() - timestamp)).to.be.lessThan(10000000); // within 10ms
  });

  it('throws in the case of an invalid nonce', function () {
    expect(function () {
      generator.extractVerifiedTimestamp('abc:123');
    }).to.throw('Invalid signature');
  });
});
