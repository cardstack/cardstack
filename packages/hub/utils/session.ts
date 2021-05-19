import { createHmac } from 'crypto';

const SECRET = process.env.SERVER_SECRET as string;

if (!SECRET) {
  throw new Error('Missing ENV var SERVER_SECRET');
}

export class NonceGenerator {
  generate(): string {
    let timestampInNanoseconds = process.hrtime.bigint().toString();
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
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    'nonce-generator': NonceGenerator;
  }
}
