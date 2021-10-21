import { inject } from '@cardstack/di';
import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'crypto';
import { Clock } from '../services/clock';
import queryString from 'query-string';
import config from 'config';

const SECRET = config.get('serverSecret') as string;
const encryptionAlgorithm = 'aes-256-gcm';
const ONE_DAY_IN_MS = 1000 * 60 * 60 * 24;

function encrypt(plaintext: string): string {
  const key = Buffer.from(SECRET, 'base64');
  const iv = randomBytes(16);
  const cipher = createCipheriv(encryptionAlgorithm, key, iv);
  const encrypted = [
    iv.toString('hex'),
    '--',
    cipher.update(plaintext, 'utf8', 'hex'),
    cipher.final('hex'),
    '--',
    cipher.getAuthTag().toString('hex'),
  ];
  return encrypted.join('');
}

function decrypt(cipherText: string) {
  const [ivString, encryptedString, authTagString] = cipherText.split('--');
  const iv = Buffer.from(ivString, 'hex');
  const key = Buffer.from(SECRET, 'base64');
  const decipher = createDecipheriv(encryptionAlgorithm, key, iv);
  decipher.setAuthTag(Buffer.from(authTagString, 'hex'));
  let decrypted = decipher.update(encryptedString, 'hex', 'utf8') + decipher.final('utf8');
  return decrypted;
}

if (!SECRET) {
  throw new Error('Missing ENV var SERVER_SECRET');
}

export class AuthenticationUtils {
  clock: Clock = inject('clock');

  generateNonce(): string {
    let timestampInNanoseconds = this.clock.hrNow().toString();
    let hmac = createHmac('sha256', SECRET);
    let nonceSignature = hmac.update(`${timestampInNanoseconds}:${SECRET}`).digest('hex');
    let nonce = `${Buffer.from(timestampInNanoseconds).toString('base64')}:${nonceSignature}`;
    return nonce;
  }

  extractVerifiedTimestamp(nonce: string): bigint {
    let [base64Timestamp, signature] = nonce.split(':');
    let timestamp = Buffer.from(base64Timestamp, 'base64').toString('ascii');
    let hmac = createHmac('sha256', SECRET);
    let expectedNonceSignature = hmac.update(`${timestamp}:${SECRET}`).digest('hex');
    if (expectedNonceSignature === signature) {
      return BigInt(timestamp);
    } else {
      throw new Error('Invalid signature');
    }
  }

  buildAuthToken(userAddress: string) {
    let timestamp = new Date(this.clock.now() + ONE_DAY_IN_MS).toISOString();
    let token = `current_user_id=${userAddress}&expires_at=${timestamp}`;
    return encrypt(token);
  }

  decryptAuthToken(encryptedAuthToken: string) {
    return decrypt(encryptedAuthToken);
  }

  validateAuthToken(encryptedAuthToken: string): string {
    let clearAuthToken = decrypt(encryptedAuthToken);
    let authTokenProps = queryString.parse(clearAuthToken);
    let expiresAt = Date.parse(authTokenProps['expires_at'] as string);
    if (expiresAt < this.clock.now()) {
      throw new Error('Auth token expired');
    }
    return authTokenProps['current_user_id'] as string;
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'authentication-utils': AuthenticationUtils;
  }
}
