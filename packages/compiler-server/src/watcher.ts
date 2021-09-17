import { ENVIRONMENTS } from './interfaces';
import Builder from './builder';
import { removeSync } from 'fs-extra';
import { join } from 'path';
import walkSync from 'walk-sync';
import sane from 'sane';
import { sep } from 'path';
import RealmManager from './realm-manager';

export function cleanCache(dir: string): void {
  console.debug('Cleaning cardCache dir: ' + dir);
  for (let subDir of ENVIRONMENTS) {
    removeSync(join(dir, subDir));
  }
  removeSync(join(dir, 'assets'));
}

export async function primeCache(realManager: RealmManager, builder: Builder): Promise<void> {
  let promises = [];

  for (let realm of realManager.realms) {
    let cards = walkSync(realm.directory, { globs: ['**/card.json'] });
    for (let cardPath of cards) {
      let fullCardUrl = new URL(cardPath.replace('card.json', ''), realm.url).href;
      console.debug(`--> Priming cache for ${fullCardUrl}`);
      promises.push(builder.buildCard(fullCardUrl));
    }
  }

  await Promise.all(promises);
  console.debug(`--> Cache primed`);
}

export function setupWatchers(realmManager: RealmManager, builder: Builder): sane.Watcher[] {
  return realmManager.realms.map((realm) => {
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
