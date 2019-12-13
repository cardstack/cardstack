import { UpstreamDocument, UpstreamIdentity } from '../document';
interface StoreEntry {
  doc: UpstreamDocument;
  generation: number;
}

export class EphemeralStorage {
  private _identity = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  private generationCounter = 0;
  private store = new Map() as Map<string, StoreEntry>;

  get identity() {
    return this._identity;
  }

  get currentGeneration() {
    return this.generationCounter;
  }

  save(doc: UpstreamDocument, id: UpstreamIdentity, realmURL: string) {
    this.generationCounter++;
    let key = [realmURL, typeof id === 'string' ? realmURL : id.originalRealm, typeof id === 'string' ? id : id.localId]
      .map(encodeURIComponent)
      .join('/');
    this.store.set(key, {
      doc,
      generation: this.generationCounter,
    });
  }

  // TODO for the delete() null out the document for the entry (tombstone) and use that to be able to determine to delete form the index

  cardsNewerThan(realmURL: string, generation = -Infinity): UpstreamDocument[] {
    return [...this.store.entries()]
      .filter(([key]) => key.indexOf(encodeURIComponent(realmURL)) === 0)
      .filter(([, entry]) => entry.generation > generation)
      .map(([, entry]) => entry.doc);
  }
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    ephemeralStorage: EphemeralStorage;
  }
}
