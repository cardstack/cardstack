import tmp from 'tmp';
import { join } from 'path';
import { CardCacheConfig } from '../../services/card-cache-config';

export class TestCardCacheConfig extends CardCacheConfig {
  tmp = tmp.dirSync();

  get root() {
    return this.tmp.name;
  }

  get cacheDirectory() {
    return join(this.root, 'node_modules', this.packageName);
  }

  cleanup() {
    this.tmp.removeCallback();
  }
}

export function resolveCard(root: string, modulePath: string): string {
  return require.resolve(modulePath, { paths: [root] });
}
