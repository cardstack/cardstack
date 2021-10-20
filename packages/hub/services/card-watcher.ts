import { sep } from 'path';
import sane from 'sane';

import Realm from '../realms/fs-realm';
import { inject } from '@cardstack/di';
import { serverLog } from '../utils/logger';
import { printCompilerError } from '@cardstack/core/src/error';

export default class CardWatcher {
  realmManager = inject('realm-manager', { as: 'realmManager' });
  builder = inject('card-builder', { as: 'builder' });

  watchers: sane.Watcher[] = [];

  watch(): void {
    serverLog.log(`\n👀 CardWatcher: watching for changes in ${this.realmManager.realms.length} realms`);
    return this.realmManager.realms.forEach((realm: Realm) => {
      serverLog.info(`--> ${realm.url}`);
      let watcher = sane(realm.directory);
      watcher.on('add', (filepath: string) => {
        this.rebuildHandler(filepath, realm);
      });
      watcher.on('change', (filepath: string) => {
        this.rebuildHandler(filepath, realm);
      });
      // watcher.on('delete', TODO);
      this.watchers.push(watcher);
    });
  }

  teardown() {
    serverLog.log(`CardWatcher: teardown`);
    for (let watcher of this.watchers) {
      watcher.close();
    }
  }

  private rebuildHandler(filepath: string, realm: Realm) {
    let segments = filepath.split(sep);
    if (shouldIgnoreChange(segments)) {
      // top-level files in the realm are not cards, we're assuming all
      // cards are directories under the realm.
      return;
    }
    let url = new URL(segments[0] + '/', realm.url).href;

    serverLog.log(`Rebuilding::START ${url}`);

    (async () => {
      try {
        await this.builder.buildCard(url);
        serverLog.log(`Rebuilding::END   ${url}`);
      } catch (err) {
        serverLog.error(printCompilerError(err));
      }
    })();
  }
}

function shouldIgnoreChange(segments: string[]): boolean {
  // top-level files in the realm are not cards, we're assuming all
  // cards are directories under the realm.
  return segments.length < 2;
}

declare module '@cardstack/di' {
  interface KnownServices {
    'card-watcher': CardWatcher;
  }
}
