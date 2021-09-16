import { RealmConfig } from '@cardstack/core/src/interfaces';
import { Project } from 'scenario-tester';
import { BASE_CARD_REALM_CONFIG } from './fixtures';
import RealmManager from '../../src/realm-manager';
import FSRealm from '../../src/realms/fs-realm';

export class ProjectTestRealm extends FSRealm {
  project: Project;

  constructor(config: RealmConfig, manager: RealmManager) {
    let project = new Project(config.url);
    project.writeSync();
    config.directory = project.baseDir;
    super(config, manager);
    this.project = project;
  }

  addCard(cardID: string, files: Project['files']): void {
    files['card.json'] = JSON.stringify(files['card.json'], null, 2);
    this.project.files[cardID] = files;
    this.project.writeSync();
  }
}

export function setupRealms(mochaContext: Mocha.Suite): {
  createRealm: (name: string) => ProjectTestRealm;
  getRealmManager: () => RealmManager;
} {
  let realmConfigs: RealmConfig[] = [BASE_CARD_REALM_CONFIG];
  let realmManager: RealmManager;

  function createRealm(name: string): ProjectTestRealm {
    return realmManager!.createRealm({ url: name }, ProjectTestRealm);
  }

  mochaContext.beforeEach(function () {
    realmManager = new RealmManager(realmConfigs);
  });

  return {
    createRealm,
    getRealmManager() {
      return realmManager;
    },
  };
}
