import { CardWithId } from './card';
import { Batch } from './pgsearch/pgclient';

export interface IndexerFactory {
  new (realmCard: CardWithId): Indexer;
}

export interface Indexer {
  update(ops: IndexingOperations): Promise<void>;
}

export class IndexingOperations {
  constructor(private batch: Batch) {}

  async save(card: CardWithId) {
    return await this.batch.save(card);
  }
}
