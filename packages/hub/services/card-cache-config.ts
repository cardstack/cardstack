import { dirname } from 'path';

export class CardCacheConfig {
  packageName = '@cardstack/compiled';

  get root() {
    return dirname(__non_webpack_require__.resolve('@cardstack/hub/package.json'));
  }

  get cacheDirectory() {
    return dirname(__non_webpack_require__.resolve('@cardstack/compiled/package.json'));
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'card-cache-config': CardCacheConfig;
  }
}
