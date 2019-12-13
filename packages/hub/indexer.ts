import { CardWithId, CardId } from './card';
import { Batch } from './pgsearch/pgclient';
import CardstackError from './error';

export interface IndexerFactory<Meta> {
  new (realmCard: CardWithId): Indexer<Meta>;
}

export interface Indexer<Meta> {
  update(meta: Meta, ops: IndexingOperations): Promise<Meta | void>;
}

export class IndexingOperations {
  private generation: number | undefined;
  constructor(private realmCard: CardWithId, private batch: Batch) {}

  async save(card: CardWithId) {
    card.generation = this.generation;
    return await this.batch.save(card);
  }

  async delete(id: CardId) {
    return await this.batch.delete(id);
  }

  async beginReplaceAll() {
    // TODO move generation to the batch, and remove the generation from the Card
    this.generation = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  }

  async finishReplaceAll() {
    if (this.generation == null) {
      throw new CardstackError('tried to finishReplaceAll when there was no beginReplaceAll');
    }
    await this.batch.deleteOtherGenerations(this.realmCard.localId, this.generation);
  }
}
