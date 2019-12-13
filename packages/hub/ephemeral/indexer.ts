import { Indexer, IndexingOperations } from '../indexer';
import { inject } from '../dependency-injection';
import { CardWithId } from '../card';

interface EphemeralMeta {
  identity: number;
  generation?: number;
}

export default class EphemeralIndexer implements Indexer<EphemeralMeta> {
  ephemeralStorage = inject('ephemeralStorage');

  constructor(private realmCard: CardWithId) {}

  async update(meta: EphemeralMeta, ops: IndexingOperations) {
    let { identity, generation } = meta || {};
    let newGeneration = this.ephemeralStorage.currentGeneration;

    if (identity !== this.ephemeralStorage.identity) {
      generation = undefined;
      await ops.beginReplaceAll();
    }

    let upstreamDocs = this.ephemeralStorage.cardsNewerThan(this.realmCard.localId, generation);
    let cards = upstreamDocs.map(doc => new CardWithId(doc.jsonapi));
    await Promise.all(cards.map(card => ops.save(card)));
    // TODO there is a bug here for when we need to delete an index entry if it no longer lives in the store.
    // test is to go directly into the index and delete a card

    if (identity !== this.ephemeralStorage.identity) {
      await ops.finishReplaceAll();
    }

    return {
      identity: this.ephemeralStorage.identity,
      generation: newGeneration,
    };
  }
}
