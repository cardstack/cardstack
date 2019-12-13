import { CardWithId, CardId } from './card';
import { Batch } from './pgsearch/pgclient';

export interface IndexerFactory<Meta> {
  new (realmCard: CardWithId): Indexer<Meta>;
}

export interface Indexer<Meta> {
  update(meta: Meta, ops: IndexingOperations): Promise<Meta | void>;
}

export class IndexingOperations {
  constructor(private realmCard: CardWithId, private batch: Batch) {}

  async save(card: CardWithId) {
    return await this.batch.save(card);
  }

  async delete(id: CardId) {
    return await this.batch.delete(id);
  }

  async beginReplaceAll() {
    this.batch.createGeneration(this.realmCard.localId);
  }

  async finishReplaceAll() {
    await this.batch.deleteOlderGenerations(this.realmCard.localId);
  }
}
