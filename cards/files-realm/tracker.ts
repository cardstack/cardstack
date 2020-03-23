import { statSync, readdirSync, readJsonSync, readFileSync, Stats } from 'fs-extra';
import { IndexingOperations } from '@cardstack/hub';
import { join } from 'path';
import merge from 'lodash/merge';
import logger from '@cardstack/logger';
import { UpstreamDocument, UpstreamIdentity } from '@cardstack/hub';
import { assertSingleResourceDoc } from '@cardstack/core/jsonapi';
import { Card } from '@cardstack/hub';
import { SingleResourceDoc } from 'jsonapi-typescript';
import { inject } from '@cardstack/hub/dependency-injection';
import { AddressableCard } from '@cardstack/hub';
import * as J from 'json-typescript';
import sane from 'sane';

const log = logger('files-realm-tracker');

export interface TrackerParams {
  fileChanged?: string;
}

// This holds the persistent state for the files-realm while the hub is running.
// It deals with file watching and noticing incremental changes.
export class FilesTracker {
  indexing = inject('indexing');

  private state: Map<string, Map<string, Entry>> = new Map();
  private ids: Map<string, UpstreamIdentity> = new Map();
  private subscriptions: Map<string, { realm: AddressableCard; watcher: undefined | sane.Watcher }> = new Map();

  async update(realmCard: AddressableCard, ops: IndexingOperations, params: TrackerParams | null): Promise<void> {
    let directory = await realmCard.value('directory');

    if (params?.fileChanged) {
      await this.targetedUpdate(ops, directory, params.fileChanged);
      return;
    }

    await this.subscribe(directory, realmCard);
    let now = crawl(directory);
    let previous = this.state.get(directory);

    if (!previous) {
      await ops.beginReplaceAll();
    }

    for (let [name, entry] of now) {
      if (entry instanceof Map) {
        // we found a directory within the top-level cards directory, so it's
        // supposed to be card.

        if (previous && !changed(previous.get(name), entry)) {
          continue;
        }
        let cardDir = join(directory, name);
        await this.reindexCard(cardDir, entry, directory, ops);
      } else {
        // we found a file in within the top-level cards directory, we ignore
        // those.
      }
    }

    if (previous) {
      for (let [name, previousEntry] of previous) {
        if (!(previousEntry instanceof Map)) {
          // it was a file before, so there's no chance we need to delete a card
          continue;
        }

        // it was a directory before, so we're responsible for checking that
        // it's still a card.

        let currentEntry = now.get(name);

        // if the directory has been deleted or replaced with a file, we need to
        // remove from search index
        if (!currentEntry || !(currentEntry instanceof Map)) {
          let cardDir = join(directory, name);
          let upstreamId = this.ids.get(cardDir);
          if (!upstreamId) {
            throw new Error(`bug in files-realm tracker. Missing upstream id.`);
          }
          await ops.delete(upstreamId);
          this.ids.delete(cardDir);
        }
      }
    } else {
      await ops.finishReplaceAll();
    }
    this.state.set(directory, now);
  }

  private async reindexCard(cardDir: string, entry: Map<string, Entry>, directory: string, ops: IndexingOperations) {
    try {
      let json = assembleCard(cardDir, entry);
      let upstreamId = {
        csId: json.data.attributes!.csId as string,
        csOriginalRealm: json.data.attributes!.csOriginalRealm as string,
      };
      await ops.save(upstreamId, new UpstreamDocument(json));
      this.ids.set(cardDir, upstreamId);
    } catch (err) {
      log.warn(`Ignoring card in ${directory} because: ${err}`);
    }
  }

  private async targetedUpdate(ops: IndexingOperations, directory: string, fileChanged: string): Promise<void> {
    if (!fileChanged.startsWith(directory)) {
      throw new Error(
        `bug in files-realm tracker: got told about a file that's not ours: ${fileChanged} vs ${directory}`
      );
    }
    let cardDirName = fileChanged.slice(directory.length + 1).split('/')[0];
    let cardDir = join(directory, cardDirName);
    let stat: Stats | undefined;
    try {
      stat = statSync(cardDir);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
    if (stat && stat.isDirectory()) {
      let entry = crawl(cardDir);
      await this.reindexCard(cardDir, entry, directory, ops);
    } else {
      let upstreamId = this.ids.get(cardDir);
      if (upstreamId) {
        await ops.delete(upstreamId);
      }
    }
  }

  private async subscribe(directory: string, realmCard: AddressableCard): Promise<void> {
    if (this.subscriptions.has(directory)) {
      return;
    }
    let enabled: boolean = (await realmCard.value('watcherEnabled')) ?? true;
    if (!enabled) {
      this.subscriptions.set(directory, { realm: realmCard, watcher: undefined });
      return;
    }

    let watcher = sane(directory, { ignored: ['node_modules'] });
    watcher.on('add', (filepath, root) => this.notifyFileDidChange(root, filepath));
    watcher.on('change', (filepath, root) => this.notifyFileDidChange(root, filepath));
    watcher.on('delete', (filepath, root) => this.notifyFileDidChange(root, filepath));
    this.subscriptions.set(directory, { realm: realmCard, watcher });
  }

  notifyFileDidChange(realmDir: string, relativeFile: string): void {
    this.notifyFileDidChangeAndWait(realmDir, relativeFile).catch(err =>
      log.error(`Error while notifying file change %s/%s: %s`, realmDir, relativeFile, err)
    );
  }

  async notifyFileDidChangeAndWait(realmDir: string, relativeFile: string): Promise<void> {
    let sub = this.subscriptions.get(realmDir);
    if (!sub) {
      log.debug(`Notified about a file we're not subscribed to: realm=${realmDir}, file=${relativeFile}`);
      return;
    }
    let params: TrackerParams = { fileChanged: join(realmDir, relativeFile) };
    await this.indexing.updateRealm(sub.realm, params as J.Object);
  }

  async willTeardown() {
    for (let { watcher } of this.subscriptions.values()) {
      if (watcher) {
        watcher.close();
      }
    }
  }
}

function changed(previous: Entry | undefined, current: Map<string, Entry>): boolean {
  if (!previous || !(previous instanceof Map)) {
    return true;
  }
  for (let [name, currentEntry] of current) {
    let previousEntry = previous.get(name);
    if (!previousEntry) {
      return true;
    }

    if (currentEntry instanceof Map) {
      // name is now a directory
      if (!(previousEntry instanceof Map)) {
        // previously it was a file, so things changed
        return true;
      }
      return changed(previousEntry, currentEntry);
    } else {
      // name is now a file
      if (previousEntry instanceof Map) {
        // previously it was a directory, so things changed
        return true;
      }
      if (previousEntry.mtime !== currentEntry.mtime || previousEntry.size !== currentEntry.size) {
        return true;
      }
    }
  }
  for (let name of previous.keys()) {
    if (!current.has(name)) {
      return true;
    }
  }
  return false;
}

type Entry = { mtime: number; size: number } | Map<string, Entry>;

function crawl(cardsDirectory: string): Map<string, Entry> {
  let output: Map<string, Entry> = new Map();
  for (let name of readdirSync(cardsDirectory)) {
    if (name.startsWith('.') || name === 'node_modules') {
      continue;
    }
    let fullName = join(cardsDirectory, name);
    let stat = statSync(fullName);
    if (stat.isDirectory()) {
      output.set(name, crawl(fullName));
    } else {
      output.set(name, { mtime: stat.mtime.getDate(), size: stat.size });
    }
  }
  return output;
}

function assembleCard(cardDirectory: string, files: Map<string, Entry>): SingleResourceDoc {
  let pkg;
  try {
    pkg = readJsonSync(join(cardDirectory, 'package.json'));
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Card does not have a valid package.json file`);
    }
    throw err;
  }

  let json;
  try {
    json = readJsonSync(join(cardDirectory, 'card.json'));
    assertSingleResourceDoc(json);
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`Card does not have a valid card.json file`);
    }
    if ('isCardstackError' in err) {
      throw new Error(`card.json is invalid because: ${err}`);
    }
    throw err;
  }

  // ensure we have an attributes object
  merge(json, {
    data: {
      attributes: {},
      meta: {
        cardDir: cardDirectory,
      },
    },
  });

  // then ensure that csFiles reflects our true on disk files only
  json.data.attributes!.csFiles = loadFiles(cardDirectory, files, ['package.json', 'card.json']);

  // and our peerDeps match the ones from package.json
  // @ts-ignore
  json.data.attributes!.csPeerDependencies = pkg.peerDependencies;
  return json;
}

function loadFiles(dir: string, files: Map<string, Entry>, exclude: string[] = []) {
  let output: NonNullable<Card['csFiles']> = Object.create(null);
  for (let [name, entry] of files) {
    if (exclude.includes(name)) {
      continue;
    }
    let fullName = join(dir, name);
    if (entry instanceof Map) {
      output[name] = loadFiles(fullName, entry);
    } else {
      output[name] = readFileSync(fullName, 'utf8');
    }
  }
  return output;
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    filesTracker: FilesTracker;
  }
}
