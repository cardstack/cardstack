import FSRealm from '../realms/fs-realm';
import { NotFound } from '@cardstack/core/src/utils/errors';
import { RawCard, RealmConfig } from '@cardstack/core/src/interfaces';
import { ensureTrailingSlash } from '@cardstack/core/src/utils';
import { RealmInterface } from '../interfaces';
import config from 'config';
import { getOwner, inject } from '@cardstack/di';

const realmsConfig = config.get('compiler.realmsConfig') as RealmConfig[];

export default class RealmManager {
  realms: RealmInterface[] = [];

  private searchIndex = inject('searchIndex');

  async ready() {
    await Promise.all(
      realmsConfig.map((config) => {
        return this.createRealm(config);
      })
    );
  }

  async teardown() {
    for (let realm of this.realms) {
      await realm.teardown();
    }
  }

  async createRealm(config: RealmConfig) {
    let realm = await getOwner(this).instantiate(
      FSRealm,
      ensureTrailingSlash(config.url),
      config.directory,
      config.watch ? this.notify.bind(this) : undefined
    );
    this.realms.push(realm);
    return realm;
  }

  private notify(cardURL: string, action: 'save' | 'delete'): void {
    this.searchIndex.notify(cardURL, action);
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
