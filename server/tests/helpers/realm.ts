import { RealmConfig } from '@cardstack/core/src/interfaces';
import { Project } from 'scenario-tester';
import { BASE_CARD_REALM_CONFIG } from './fixtures';

export class RealmHelper {
  realm: Project;

  constructor(name: string) {
    this.realm = new Project(name);
    this.write();
  }

  addCard(id: string, files: Project['files']): void {
    files['card.json'] = JSON.stringify(files['card.json'], null, 2);
    this.realm.files[id] = files;

    this.write();
  }
  write(): void {
    this.realm.writeSync();
  }
  get dir(): string {
    return this.realm.baseDir;
  }
}

export function setupRealms(
  hooks: NestedHooks
): {
  createRealm: (name: string) => RealmHelper;
  getRealms: () => RealmConfig[];
} {
  let realms: RealmConfig[] = [BASE_CARD_REALM_CONFIG];

  function createRealm(name: string): RealmHelper {
    let realm = new RealmHelper(name);
    realms.unshift({ url: `https://${name}`, directory: realm.dir });
    return realm;
  }

  function getRealms(): RealmConfig[] {
    return realms;
  }

  hooks.beforeEach(function () {
    realms = [BASE_CARD_REALM_CONFIG];
  });
  hooks.afterEach(function () {
    realms = [];
  });

  return { createRealm, getRealms };
}
