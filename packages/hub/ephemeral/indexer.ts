import { Indexer, IndexingOperations } from '../indexer';
import { inject } from '../dependency-injection';
import { AddressableCard } from '../card';

interface EphemeralMeta {
  identity: number;
  generation?: number;
}

export default class EphemeralIndexer implements Indexer<EphemeralMeta> {
  ephemeralStorage = inject('ephemeralStorage');

  constructor(private realmCard: AddressableCard) {}

  async update(meta: EphemeralMeta, ops: IndexingOperations) {
    let { identity, generation } = meta || {};
    let newGeneration = this.ephemeralStorage.currentGeneration;

    if (identity !== this.ephemeralStorage.identity) {
      generation = undefined;
      await ops.beginReplaceAll();
    }

    let entries = this.ephemeralStorage.entriesNewerThan(this.realmCard.csId, generation);
    for (let entry of entries) {
      if (entry.doc) {
        await ops.save(entry.id, entry.doc);
      } else {
        await ops.delete(entry.id);
      }
    }

    if (identity !== this.ephemeralStorage.identity) {
      await ops.finishReplaceAll();
    }

    return {
      identity: this.ephemeralStorage.identity,
      generation: newGeneration,
    };
  }
}
