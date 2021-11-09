import { RawCard, RealmConfig } from '@cardstack/core/src/interfaces';
import FSRealm from '../realms/fs-realm';
import { NotFound } from '@cardstack/core/src/utils/errors';
import { RealmInterface } from '../interfaces';
import { ensureTrailingSlash } from '../utils/path';
import config from 'config';
import { getOwner } from '@cardstack/di';

const realmsConfig = config.get('compiler.realmsConfig') as RealmConfig[];

export default class RealmManager {
  realms: RealmInterface[] = [];

  async ready() {
    await Promise.all(
      realmsConfig.map((config) => {
        return this.createRealm(config);
      })
    );
  }

  async createRealm(config: RealmConfig) {
    config.url = ensureTrailingSlash(config.url);
    let realm = await getOwner(this).instantiate(
      FSRealm,
      config.url,
      config.directory,
      config.watch ? this.notify : undefined
    );
    this.realms.push(realm);
    return realm;
  }

  notify(cardURL: string, action: 'save' | 'delete'): void {
    throw new Error('not implemented');
  }

  getRealmForCard(url: string): RealmInterface {
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
    return this.getRealmForCard(url).read(url);
  }

  async update(raw: RawCard): Promise<RawCard> {
    return this.getRealmForCard(raw.url).update(raw);
  }

  async delete(cardURL: string) {
    return this.getRealmForCard(cardURL).delete(cardURL);
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'realm-manager': RealmManager;
  }
}
