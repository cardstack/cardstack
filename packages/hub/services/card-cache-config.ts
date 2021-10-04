import { join } from 'path';

export class CardCacheConfig {
  packageName = '@cardstack/compiled';

  get root() {
    return __dirname;
  }

  get cacheDirectory() {
    return join(this.root, '..', '..', 'compiled');
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'card-cache-config': CardCacheConfig;
  }
}
