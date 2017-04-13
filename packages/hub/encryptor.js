const crypto = require('crypto');
const { declareInjections } = require('@cardstack/di');

module.exports = declareInjections({
  key: 'config:encryption-key'
},

class Encryptor {

  static create({ key }) {
    return new this(key);
  }

  constructor(key) {
    if (!(key instanceof Buffer) || key.length < 32) {
      throw new Error("key must be a buffer of at least 32 bytes");
    }
    this.key = key;
  }

  encryptAndSign(value) {
    // 32 bytes because our cipher block size is 32 bytes
    let iv = crypto.randomBytes(32);

    // Curious onlookers should realize that picking the wrong thing
    // here can be fatal -- openssl includes some cipher modes that
    // look similar that you should never ever use, like
    // aes-256-ecb. And we are relying on the fact that gcm mode does
    // both integrity and confidentiality.
    let cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);

    let ciphertext = cipher.update(JSON.stringify(value), 'utf8', 'base64');
    ciphertext += cipher.final('base64');

    return `${ciphertext}--${iv.toString('base64')}--${cipher.getAuthTag().toString('base64')}`;
  }

  verifyAndDecrypt(value) {
    let parts = value.split('--');
    if (parts.length !== 3) {
      throw new Error("Not a valid signed message");
    }
    let [ciphertext, iv, authTag] = parts;
    let decipher = crypto.createDecipheriv('aes-256-gcm', this.key, new Buffer(iv, 'base64'));
    decipher.setAuthTag(new Buffer(authTag, 'base64'));
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }

});
