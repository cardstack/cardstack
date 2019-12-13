import { CardWithId } from './card';
import { Batch } from './pgsearch/pgclient';
import CardstackError from './error';

export interface IndexerFactory {
  new (realmCard: CardWithId): Indexer;
}
export type Meta<T> = T; // I really wanted to do something like: Meta<T extends JSON.Value> = T, but i need some help

export interface Indexer {
  update(meta: Meta<any>, ops: IndexingOperations): Promise<Meta<any> | void>;
}

export class IndexingOperations {
  private generation: number | undefined;
  constructor(private realmCard: CardWithId, private batch: Batch) {}

  async save(card: CardWithId) {
    card.generation = this.generation;
    return await this.batch.save(card);
  }

  async beginReplaceAll() {
    this.generation = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  }

  async finishReplaceAll() {
    if (this.generation == null) {
      throw new CardstackError('tried to finishReplaceAll when there was no beginReplaceAll');
    }
    await this.batch.deleteOtherGenerations(this.realmCard.localId, this.generation);
  }
}
