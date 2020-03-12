import { statSync, readdirSync, readJsonSync, readFileSync } from 'fs-extra';
import { IndexingOperations } from '@cardstack/core/indexer';
import { join } from 'path';
import merge from 'lodash/merge';
import logger from '@cardstack/logger';
import { UpstreamDocument, UpstreamIdentity } from '@cardstack/core/document';
import { assertSingleResourceDoc } from '@cardstack/core/jsonapi';
import { Card } from '@cardstack/core/card';
import { SingleResourceDoc } from 'jsonapi-typescript';

const log = logger('files-realm-tracker');

// This holds the persistent state for the files-realm while the hub is running.
// It deals with file watching and noticing incremental changes.
export class FilesTracker {
  operationsCount = 0;

  private state: Map<string, Map<string, Entry>> = new Map();
  private ids: Map<string, UpstreamIdentity> = new Map();

  async update(directory: string, ops: IndexingOperations): Promise<void> {
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
        let json;
        try {
          json = assembleCard(cardDir, entry);
        } catch (err) {
          log.warn(`Ignoring card in ${directory} because: ${err}`);
          continue;
        }
        let upstreamId = {
          csId: json.data.attributes!.csId as string,
          csOriginalRealm: json.data.attributes!.csOriginalRealm as string,
        };
        await ops.save(upstreamId, new UpstreamDocument(json));
        this.operationsCount++;
        this.ids.set(cardDir, upstreamId);
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
          this.operationsCount++;
          this.ids.delete(cardDir);
        }
      }
    } else {
      await ops.finishReplaceAll();
    }
    this.state.set(directory, now);
  }

  notifyFileDidChange(_fullPath: string): void {}
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
