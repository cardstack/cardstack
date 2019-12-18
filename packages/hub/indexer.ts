import { CardWithId, CardId } from './card';
import { Batch } from './pgsearch/pgclient';
import { UpstreamDocument } from './document';
import { ScopedCardService } from './cards-service';

export interface IndexerFactory<Meta> {
  new (realmCard: CardWithId): Indexer<Meta>;
}

export interface Indexer<Meta> {
  update(meta: Meta, ops: IndexingOperations): Promise<Meta | void>;
}

export class IndexingOperations {
  constructor(private realmCard: CardWithId, private batch: Batch, private cards: ScopedCardService) {}

  async save(doc: UpstreamDocument) {
    return await this.batch.save(this.cards.instantiate(doc.jsonapi));
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
