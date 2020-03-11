import { IndexingOperations } from '@cardstack/core/indexer';
import { join } from 'path';
import logger from '@cardstack/logger';
import { UpstreamDocument, UpstreamIdentity } from '@cardstack/core/document';
import { Entry, readCard, crawl } from '@cardstack/core/card-file-utils';

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

        try {
          let cardDir = join(directory, name);
          let json = readCard(cardDir, entry);
          let upstreamId = {
            csId: json.data.attributes!.csId as string,
            csOriginalRealm: json.data.attributes!.csOriginalRealm as string,
          };
          await ops.save(upstreamId, new UpstreamDocument(json));
          this.operationsCount++;
          this.ids.set(cardDir, upstreamId);
        } catch (err) {
          log.warn(`Ignoring card in ${directory} because: ${err}`);
        }
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

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    filesTracker: FilesTracker;
  }
}
