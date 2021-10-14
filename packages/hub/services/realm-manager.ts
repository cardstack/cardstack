import { RawCard, RealmConfig } from '@cardstack/core/src/interfaces';
import Realm from '../realms/fs-realm';
import { NotFound } from '../utils/error';
import { RealmInterface } from '../interfaces';
import { ensureTrailingSlash } from '../utils/path';
import config from 'config';

const realmsConfig = config.get('compiler.realmsConfig') as RealmConfig[];

export default class RealmManager implements RealmInterface {
  realms: Realm[] = realmsConfig.map((realm) => new Realm(realm, this));

  createRealm(config: RealmConfig, klass?: any) {
    let realm = klass ? new klass(config, this) : new Realm(config, this);
    this.realms.push(realm);
    return realm;
  }

  getRealm(url: string): RealmInterface {
    url = ensureTrailingSlash(url);

    for (let realm of this.realms) {
      if (!url.startsWith(realm.url)) {
        continue;
      }

      return realm;
    }

    throw new NotFound(`${url} is not a realm we know about`);
  }

  doesCardExist(url: string): boolean {
    return this.getRealm(url).doesCardExist(url);
  }

  async getRawCard(url: string): Promise<RawCard> {
    return this.getRealm(url).getRawCard(url);
  }

  async updateCardData(cardURL: string, attributes: any): Promise<RawCard> {
    return this.getRealm(cardURL).updateCardData(cardURL, attributes);
  }

  async createDataCard(realmURL: string, data: any, adoptsFrom: string, cardURL?: string): Promise<RawCard> {
    let realm = this.getRealm(realmURL);
    return realm.createDataCard(data, adoptsFrom, cardURL);
  }

  async deleteCard(cardURL: string) {
    return this.getRealm(cardURL).deleteCard(cardURL);
  }
}

declare module '@cardstack/di' {
  interface KnownServices {
    'realm-manager': RealmManager;
  }
}
