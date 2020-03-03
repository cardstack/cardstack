import { Card } from '@cardstack/core/card';
import stringify from 'fast-json-stable-stringify';
import { createHash } from 'crypto';
import { homedir } from 'os';
import { join } from 'path';
import { existsSync } from 'fs';
import { Deferred } from './deferred';
import { outputFile, mkdirp, ensureSymlink } from 'fs-extra';
import { satisfies, coerce } from 'semver';
import { ModuleLoader } from '@cardstack/core/module-loader';
import { SingleResourceDoc } from 'jsonapi-typescript';

export const cardFilesCache = process.env.CARD_FILES_CACHE ?? join(homedir(), '.cardstack', 'card-files-cache');

export class ModuleService implements ModuleLoader {
  activeCards = new Map() as Map<string, Promise<void>>;

  writeCounter = 0;

  async load(card: Card, localModulePath: string, exportedName = 'default'): Promise<any> {
    // using md5 because this is just for cache validation, not cryptographic
    // collision resistance

    let cardDir;

    if (card.cardDir) {
      cardDir = card.cardDir;
    } else {
      let hash = createHash('md5');
      hash.update(stringify(await toIdempotentDoc(card)));
      cardDir = join(cardFilesCache, hash.digest('hex'));
      await this.cachedWriteCard(card, cardDir);
    }
    // @ts-ignore
    let module = await import(join(cardDir, localModulePath)); // we are using ESM for module loading
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
    if (wroteAnyFiles && card.csPeerDependencies) {
      await this.linkPeerDependencies(card.csPeerDependencies, outDir);
    }
    this.writeCounter++;
  }

  private async writeCardFiles(files: NonNullable<Card['csFiles']>, outDir: string): Promise<boolean> {
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

  private async linkPeerDependencies(deps: NonNullable<Card['csPeerDependencies']>, outDir: string) {
    for (let [packageName, range] of Object.entries(deps)) {
      let peerDepDir = await this.locatePeerDep(packageName);
      // @ts-ignore
      let version = (await import(join(peerDepDir, 'package.json'))).version as string;
      if (!satisfies(coerce(version)!, range)) {
        throw new Error(`version ${range} of ${packageName} is not available to cards on this hub`);
      }
      await ensureSymlink(peerDepDir, join(outDir, 'node_modules', packageName), 'dir');
    }
  }

  private async locatePeerDep(packageName: string): Promise<string> {
    // right now these are the only ones that are supported. We can choose to allow
    // any of hub's dependencies here too though.
    if (packageName === '@cardstack/hub') {
      return __dirname;
    }
    if (packageName === '@cardstack/core') {
      return join(__dirname, '..', 'core');
    }
    throw new Error(`peerDependency ${packageName} is not available to cards`);
  }
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    modules: ModuleService;
  }
}

async function toIdempotentDoc(card: Card): Promise<SingleResourceDoc> {
  let idempotentDoc = (await card.asUpstreamDoc()).jsonapi;
  if (idempotentDoc.data.attributes) {
    delete idempotentDoc.data.attributes.csCreated;
    delete idempotentDoc.data.attributes.csUpdated;
  }
  if (idempotentDoc.included) {
    for (let resource of idempotentDoc.included) {
      if (resource.attributes) {
        delete resource.attributes.csCreated;
        delete resource.attributes.csUpdated;
      }
    }
  }
  return idempotentDoc;
}
