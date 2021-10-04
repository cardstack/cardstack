import { ENVIRONMENTS } from '@cardstack/hub/interfaces';
import Builder from '@cardstack/hub/services/card-builder';
import { removeSync } from 'fs-extra';
import { join } from 'path';
import sane from 'sane';
import { sep } from 'path';
import RealmManager from '@cardstack/hub/services/realm-manager';
import Realm from '@cardstack/hub/realms/fs-realm';

export function cleanCache(dir: string): void {
  console.debug('Cleaning cardCache dir: ' + dir);
  for (let subDir of ENVIRONMENTS) {
    removeSync(join(dir, subDir));
  }
  removeSync(join(dir, 'assets'));
}

export function setupWatchers(realmManager: RealmManager, builder: Builder): sane.Watcher[] {
  return realmManager.realms.map((realm: Realm) => {
    let watcher = sane(realm.directory);
    const handler = (filepath: string /* root: string, stat?: Stats */) => {
      let segments = filepath.split(sep);
      if (segments.length < 2) {
        // top-level files in the realm are not cards, we're assuming all
        // cards are directories under the realm.
        return;
      }
      let url = new URL(segments[0] + '/', realm.url).href;

      console.debug(`!-> rebuilding card ${url}`);

      (async () => {
        try {
          await builder.buildCard(url);
        } catch (err) {
          console.log(err);
        }
      })();
    };
    watcher.on('add', handler);
    watcher.on('change', handler);
    watcher.on('delete', handler);
    return watcher;
  });
}
