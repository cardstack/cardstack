import { Indexer, IndexingOperations, IndexingMeta } from '../indexer';
import { inject } from '../dependency-injection';
import { CardWithId } from '../card';

export default class EphemeralIndexer implements Indexer {
  ephemeralStorage = inject('ephemeralStorage');

  constructor(private realmCard: CardWithId) {}

  async update(meta: IndexingMeta, ops: IndexingOperations) {
    let upstreamDocs = this.ephemeralStorage.allCards(this.realmCard.localId);
    let { identity } = meta || {};
    let newGeneration = this.ephemeralStorage.currentGeneration;

    // TODO use generation to get only the newer cards that haven't been indexed yet
    let cards = upstreamDocs.map(doc => new CardWithId(doc.jsonapi));

    if (identity !== this.ephemeralStorage.identity) {
      await ops.beginReplaceAll();
    }

    await Promise.all(cards.map(card => ops.save(card)));

    if (identity !== this.ephemeralStorage.identity) {
      await ops.finishReplaceAll();
    }

    return {
      identity: this.ephemeralStorage.identity,
      generation: newGeneration,
    };
  }
}
