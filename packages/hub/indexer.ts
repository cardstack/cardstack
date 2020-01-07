import { AddressableCard } from './card';
import { Batch } from './pgsearch/pgclient';
import { UpstreamDocument, UpstreamIdentity, upstreamIdToCardId } from './document';
import { ScopedCardService } from './cards-service';
import { getOwner } from './dependency-injection';

export interface IndexerFactory<Meta> {
  new (realmCard: AddressableCard): Indexer<Meta>;
}

export interface Indexer<Meta> {
  update(meta: Meta, ops: IndexingOperations): Promise<Meta | void>;
}

export class IndexingOperations {
  constructor(private realmCard: AddressableCard, private batch: Batch, private cards: ScopedCardService) {}

  async save(upstreamId: UpstreamIdentity, doc: UpstreamDocument) {
    let id = upstreamIdToCardId(upstreamId, this.realmCard.csId);
    let card = await getOwner(this).instantiate(AddressableCard, doc.jsonapi, this.cards, id);
    return await this.batch.save(card);
  }

  async delete(upstreamId: UpstreamIdentity) {
    let id = upstreamIdToCardId(upstreamId, this.realmCard.csId);
    return await this.batch.delete(id);
  }

  async beginReplaceAll() {
    this.batch.createGeneration(this.realmCard.csId);
  }

  async finishReplaceAll() {
    await this.batch.deleteOlderGenerations(this.realmCard.csId);
  }
}
