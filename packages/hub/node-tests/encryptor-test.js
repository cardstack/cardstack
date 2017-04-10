const Encryptor = require('@cardstack/hub/encryptor');
const crypto = require('crypto');

describe('hub/encryptor', function() {
  it('insisted on a well-formed key', function() {
    let complaint = 'key must be a buffer of at least 32 bytes';
    expect(() => new Encryptor()).throws(complaint);
    expect(() => new Encryptor('x')).throws(complaint);
    expect(() => new Encryptor('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).throws(complaint);
    expect(() => new Encryptor(crypto.randomBytes(31))).throws(complaint);
  });

  it('works round trip', function() {
    let e = new Encryptor(crypto.randomBytes(32));
    let message = { hello: 'world' };
    let ciphertext = e.encryptAndSign(message);
    let output = e.verifyAndDecrypt(ciphertext);
    expect(output).deep.equals(message);
  });

  it('changing any section causes rejection', function() {
    let e = new Encryptor(crypto.randomBytes(32));
    let message = { hello: 'world' };
    let ciphertext = e.encryptAndSign(message);
    let buffer = new Buffer(ciphertext, 'utf8');
    let sections = ciphertext.split('--');
    for (let i = 0; i < buffer.length; i+= sections.shift().length + 2) {
      let copied = Buffer.from(buffer);
      copied[i] += 1;
      expect(() => e.verifyAndDecrypt(copied.toString('utf8'))).throws(/unable to authenticate data/);
    }
    expect(e.verifyAndDecrypt(buffer.toString('utf8'))).to.deep.equal(message);
  });

});
