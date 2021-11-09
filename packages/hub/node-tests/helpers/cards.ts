import { Project } from 'scenario-tester';
import tmp from 'tmp';
import { join } from 'path';

import { RawCard, RealmConfig } from '@cardstack/core/src/interfaces';
import { CardCacheConfig } from '../../services/card-cache-config';
import FSRealm from '../../realms/fs-realm';

export class TestCardCacheConfig extends CardCacheConfig {
  tmp = tmp.dirSync();

  get root() {
    return this.tmp.name;
  }

  get cacheDirectory() {
    return join(this.root, 'node_modules', this.packageName);
  }

  cleanup() {
    this.tmp.removeCallback();
  }
}

export class ProjectTestRealm extends FSRealm {
  project: Project;

  constructor(config: RealmConfig) {
    let project = new Project(config.url.replace(/\/$/, ''));
    project.writeSync();
    config.directory = project.baseDir;
    super(config);
    this.project = project;
  }

  addCard(cardID: string, files: Project['files']): void {
    files['card.json'] = JSON.stringify(files['card.json'], null, 2);
    this.project.files[cardID] = files;
    this.project.writeSync();
  }

  addRawCard(card: RawCard) {
    let c: any = Object.assign({}, card);
    let files = c.files || {};
    let url = c.url.replace(this.url, '');
    delete c.files;
    delete c.url;
    files['card.json'] = c;

    this.addCard(url, files);
  }

  getFile(path: string) {
    return this.project.files[path];
  }
}

export function resolveCard(root: string, modulePath: string): string {
  return require.resolve(modulePath, { paths: [root] });
}
