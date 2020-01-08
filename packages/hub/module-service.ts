import { Card, CardFiles } from './card';
import stringify from 'fast-json-stable-stringify';
import { createHash } from 'crypto';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';
import { Deferred } from './deferred';
import { outputFile, mkdirp } from 'fs-extra';

export class ModuleService {
  cardFilesCache = process.env.CARD_FILES_CACHE ?? join(homedir(), '.cardstack', 'card-files-cache');

  activeCards = new Map() as Map<string, Promise<void>>;

  async load(card: Card, localModulePath: string, exportedName = 'default'): Promise<any> {
    // using md5 because this is just for cache validation, not cryptographic
    // collision resistance
    let hash = createHash('md5');
    hash.update(stringify((await card.asUpstreamDoc()).jsonapi));
    let cardDir = join(this.cardFilesCache, hash.digest('hex'));
    await this.cachedWriteCard(card, cardDir);
    let module = await import(join(cardDir, localModulePath));
    return module[exportedName];
  }

  private async cachedWriteCard(card: Card, outDir: string): Promise<void> {
    let active = this.activeCards.get(outDir);
    if (active) {
      await active;
      return;
    }
    if (existsSync(outDir)) {
      return;
    }
    let deferred = new Deferred<void>();
    this.activeCards.set(outDir, deferred.promise);
    deferred.fulfill(
      (async () => {
        try {
          await this.writeCard(card, outDir);
        } finally {
          this.activeCards.delete(outDir);
        }
      })()
    );
    await deferred.promise;
  }

  private async writeCard(card: Card, outDir: string): Promise<void> {
    let wroteAnyFiles = false;
    if (card.csFiles) {
      wroteAnyFiles = await this.writeCardFiles(card.csFiles, outDir);
    }
    if (!wroteAnyFiles) {
      // if we wrote any files, this already got created automatically. But if
      // we didn't, we still want to cache our empty card.
      await mkdirp(outDir);
    }
  }

  private async writeCardFiles(files: CardFiles, outDir: string): Promise<boolean> {
    let wroteAnyFiles = false;
    for (let [filename, entry] of Object.entries(files)) {
      if (typeof entry === 'string') {
        await outputFile(join(outDir, filename), entry);
        wroteAnyFiles = true;
      } else {
        wroteAnyFiles = wroteAnyFiles || (await this.writeCardFiles(entry, join(outDir, filename)));
      }
    }
    return wroteAnyFiles;
  }
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    modules: ModuleService;
  }
}
