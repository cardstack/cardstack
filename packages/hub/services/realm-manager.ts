import { RawCard, RealmConfig } from '@cardstack/core/src/interfaces';
import FSRealm from '../realms/fs-realm';
import { NotFound } from '@cardstack/core/src/utils/errors';
import { RealmInterface } from '../interfaces';
import { ensureTrailingSlash } from '../utils/path';
import config from 'config';

const realmsConfig = config.get('compiler.realmsConfig') as RealmConfig[];

export default class RealmManager {
  realms: RealmInterface[] = realmsConfig.map((realm) => new FSRealm(realm, this));

  createRealm(config: RealmConfig, klass?: any) {
    config.url = ensureTrailingSlash(config.url);
    let realm = klass ? new klass(config, this) : new FSRealm(config, this);
    this.realms.push(realm);
    return realm;
  }

  getRealm(url: string): FSRealm {
    url = ensureTrailingSlash(url);

    for (let realm of this.realms) {
      if (!url.startsWith(realm.url)) {
        continue;
      }

      return realm;
    }

    throw new NotFound(`${url} is not a realm we know about`);
  }

  async read(url: string): Promise<RawCard> {
    return this.getRealm(url).read(url);
  }

  async update(raw: RawCard): Promise<RawCard> {
    return this.getRealm(raw.url).update(raw);
  }

  async delete(cardURL: string) {
    return this.getRealm(cardURL).delete(cardURL);
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'realm-manager': RealmManager;
  }
}
