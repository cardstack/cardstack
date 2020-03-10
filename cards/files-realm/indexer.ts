import { Indexer, IndexingOperations } from '@cardstack/core/indexer';
import { AddressableCard } from '@cardstack/core/card';
import { inject } from '@cardstack/hub/dependency-injection';

export default class FilesIndexer implements Indexer<unknown> {
  filesTracker = inject('filesTracker');

  constructor(private realmCard: AddressableCard) {}

  // we delegate to the FilesTracker because it has a lifetime that lasts as
  // long as the DI container, whereas this indexer can be short-lived.
  async update(_meta: unknown, ops: IndexingOperations) {
    let directory: string = await this.realmCard.value('directory');
    return await this.filesTracker.update(directory, ops);
  }
}
