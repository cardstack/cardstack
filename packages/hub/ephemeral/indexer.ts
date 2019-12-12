import { Indexer, IndexingOperations } from '../indexer';
import { inject } from '../dependency-injection';
import { CardWithId } from '../card';

export default class EphemeralIndexer implements Indexer {
  ephemeralStorage = inject('ephemeralStorage');

  constructor(/*private realmCard: CardWithId*/) {}

  async update(ops: IndexingOperations): Promise<void> {
    let upstreamDocs = this.ephemeralStorage.allCards();
    let cards = upstreamDocs.map(doc => new CardWithId(doc.jsonapi));
    await Promise.all(cards.map(card => ops.save(card)));
  }
}
