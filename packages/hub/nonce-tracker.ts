import { inject } from './dependency-injection';
import { WrappedNodeRedisClient } from 'handy-redis';

const KEY_PREFIX = 'nonce:recently-used:';
export const MAX_NONCE_AGE_NS = BigInt(1000000 * 1000 * 60 * 5); // 5 minutes
const NS_PER_SEC = 1000000000;
const MAX_NONCE_AGE_SEC = Number(MAX_NONCE_AGE_NS / BigInt(NS_PER_SEC));

export default class NonceTracker {
  redisClient: WrappedNodeRedisClient = inject('redis-client', { as: 'redisClient' });

  async wasRecentlyUsed(nonce: string): Promise<boolean> {
    let result = await this.redisClient.exists(`${KEY_PREFIX}${nonce}`);
    return result === 1;
  }
  async markRecentlyUsed(nonce: string): Promise<void> {
    // Add a redis key which expiring shortly after the nonce reaches its max age. There is
    // no need to track it after that as it will be considered unusable due to being expired.
    await this.redisClient.setex(`${KEY_PREFIX}${nonce}`, MAX_NONCE_AGE_SEC * 1.1, '1');
  }
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    'nonce-tracker': NonceTracker;
  }
}
