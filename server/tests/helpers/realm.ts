import { RealmInterface } from './../../src/interfaces';
import { RealmConfig } from '@cardstack/core/src/interfaces';
import { Project } from 'scenario-tester';
import { BASE_CARD_REALM_CONFIG } from './fixtures';

export class ProjectTestRealm implements RealmInterface {
  realm: Project;

  constructor(name: string) {
    this.realm = new Project(name);
    this.realm.writeSync();
  }

  addCard(cardID: string, files: Project['files']): void {
    files['card.json'] = JSON.stringify(files['card.json'], null, 2);
    this.realm.files[cardID] = files;
    this.realm.writeSync();
  }

  get directory(): string {
    return this.realm.baseDir;
  }

  getNextID(url: string): string {
    return url + '-1';
  }

  getRawCard(cardURL: string): RawCard {
    throw Error('unimplemented');
  }

  updateCardData(cardURL: string, attributes: any): void {
    throw Error('unimplemented');
  }
  deleteCard(cardURL: string): void {
    throw Error('unimplemented');
  }
}

export function setupRealms(
  hooks: NestedHooks
): {
  createRealm: (name: string) => ProjectTestRealm;
  getRealmConfigs: () => RealmConfig[];
} {
  let realmConfigs: RealmConfig[] = [BASE_CARD_REALM_CONFIG];

  function createRealm(name: string): ProjectTestRealm {
    let realm = new ProjectTestRealm(name);
    realmConfigs.unshift({
      url: `https://${name}`,
      directory: realm.directory,
    });
    return realm;
  }

  function getRealmConfigs(): RealmConfig[] {
    return realmConfigs;
  }

  hooks.beforeEach(function () {
    realmConfigs = [BASE_CARD_REALM_CONFIG];
  });
  hooks.afterEach(function () {
    realmConfigs = [];
  });

  return { createRealm, getRealmConfigs };
}
