import FSRealm from '../realms/fs-realm';
import { NotFound } from '@cardstack/core/src/utils/errors';
import { CardId, RawCard, RealmConfig, Unsaved } from '@cardstack/core/src/interfaces';
import { ensureTrailingSlash, removeTrailingSlash } from '@cardstack/core/src/utils';
import { RealmInterface } from '../interfaces';
import { getOwner, injectionReady } from '@cardstack/di';
import { service } from '@cardstack/hub/services';

export default class RealmManager {
  realms: RealmInterface<any>[] = [];

  private realmsConfig = service('realmsConfig');
  private searchIndex = service('searchIndex');

  async ready() {
    await injectionReady(this, 'realmsConfig');
    await Promise.all(
      this.realmsConfig.realms.map((config) => {
        return this.createRealm(config);
      })
    );
  }

  async teardown() {
    for (let realm of this.realms) {
      await realm.teardown();
    }
  }

  private async createRealm(config: RealmConfig) {
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
    this.searchIndex.notify(removeTrailingSlash(cardURL), action);
  }

  parseCardURL(cardURL: string): CardId {
    for (let realm of this.realms) {
      if (cardURL.startsWith(realm.url)) {
        return {
          realm: realm.url,
          id: cardURL.slice(realm.url.length),
        };
      }
    }
    throw new NotFound(`card URL ${cardURL} is not in a configured realm`);
  }

  private findRealm(targetRealm: string): RealmInterface {
    targetRealm = ensureTrailingSlash(targetRealm);
    for (let realm of this.realms) {
      if (targetRealm === realm.url) {
        return realm;
      }
    }
    throw new NotFound(`${targetRealm} is not a realm we know about`);
  }

  async create(card: RawCard<Unsaved>): Promise<RawCard> {
    return this.findRealm(card.realm).create(card);
  }

  async read(cardId: CardId): Promise<RawCard> {
    return this.findRealm(cardId.realm).read(cardId);
  }

  async update(raw: RawCard): Promise<RawCard> {
    return this.findRealm(raw.realm).update(raw);
  }

  async delete(cardId: CardId) {
    return this.findRealm(cardId.realm).delete(cardId);
  }
}

declare module '@cardstack/hub/services' {
  interface HubServices {
    'realm-manager': RealmManager;
  }
}
