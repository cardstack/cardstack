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

declare module '@cardstack/di' {
  interface KnownServices {
    'card-cache-config': CardCacheConfig;
  }
}
