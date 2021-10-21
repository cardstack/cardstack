const KEY_PREFIX = 'nonce:recently-used:';
export const MAX_NONCE_AGE_NS = BigInt(1000000 * 1000 * 60 * 5); // 5 minutes
const NS_PER_SEC = 1000000000;
const MAX_NONCE_AGE_SEC = Number(MAX_NONCE_AGE_NS / BigInt(NS_PER_SEC));

export default class NonceTracker {
  #set = new Set();

  async wasRecentlyUsed(nonce: string): Promise<boolean> {
    return Promise.resolve(this.#set.has(`${KEY_PREFIX}${nonce}`));
  }
  async markRecentlyUsed(nonce: string): Promise<void> {
    // TODO: Add a key which expiring shortly after the nonce reaches its max age. There is
    // no need to track it after that as it will be considered unusable due to being expired.
    console.log('Key should be set to expire in ', MAX_NONCE_AGE_SEC * 1.1, ' seconds');
    this.#set.add(`${KEY_PREFIX}${nonce}`);
    return Promise.resolve();
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'nonce-tracker': NonceTracker;
  }
}
