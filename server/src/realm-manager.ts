import { RawCard, RealmConfig } from '@cardstack/core/src/interfaces';
import Realm from './realms/fs-realm';
import { NotFound } from './middleware/errors';
import { RealmInterface } from './interfaces';

export default class RealmManager {
  realms: Realm[];

  constructor(realmConfigs: RealmConfig[]) {
    this.realms = realmConfigs.map((realm) => new Realm(realm, this));
  }

  createRealm(config: RealmConfig, klass?: any) {
    let realm = klass ? new klass(config, this) : new Realm(config, this);
    this.realms.push(realm);
    return realm;
  }

  getRealm(url: string): RealmInterface {
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
