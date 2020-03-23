import { Indexer, IndexingOperations } from '@cardstack/hub';
import { AddressableCard } from '@cardstack/hub';
import { inject } from '@cardstack/hub/dependency-injection';
import { TrackerParams } from './tracker';

export default class FilesIndexer implements Indexer<unknown, TrackerParams> {
  filesTracker = inject('filesTracker');

  constructor(private realmCard: AddressableCard) {}

  // we delegate to the FilesTracker because it has a lifetime that lasts as
  // long as the DI container, whereas this indexer can be short-lived.
  async update(_meta: unknown, ops: IndexingOperations, params: TrackerParams | null) {
    return await this.filesTracker.update(this.realmCard, ops, params);
  }
}
