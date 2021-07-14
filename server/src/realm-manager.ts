import { RawCard, RealmConfig } from '@cardstack/core/src/interfaces';
import Realm from './realm';
import { NotFound } from './middleware/errors';

export default class RealmManager {
  realms: Realm[];

  constructor(realmConfigs: RealmConfig[]) {
    this.realms = realmConfigs.map((realm) => new Realm(realm));
  }

  getRealm(url: string): Realm {
    for (let realm of this.realms) {
      if (!url.startsWith(realm.url)) {
        continue;
      }

      return realm;
    }

    throw new NotFound(`${url} is not a realm we know about`);
  }

  doesCardExist(url: string): boolean {
    let realm = this.getRealm(url);
    return realm.doesCardExist(url);
  }

  async getRawCard(url: string): Promise<RawCard> {
    let realm = this.getRealm(url);
    return realm.getRawCard(url);
  }

  async updateCardData(cardURL: string, attributes: any): Promise<void> {
    let realm = this.getRealm(cardURL);
    realm.updateCardData(cardURL, attributes);
  }

  async deleteCard(cardURL: string) {
    let realm = this.getRealm(cardURL);
    realm.deleteCard(cardURL);
  }
}
