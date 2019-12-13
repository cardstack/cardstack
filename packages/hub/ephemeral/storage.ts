import { UpstreamDocument, UpstreamIdentity } from '../document';
import { CardId } from '../card';
interface StoreEntry {
  id: CardId;
  doc: UpstreamDocument | null;
  generation: number;
}

export class EphemeralStorage {
  private generationCounter = 0;
  private _identity = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  private _store = new Map() as Map<string, StoreEntry>;

  get identity() {
    return this._identity;
  }

  get currentGeneration() {
    return this.generationCounter;
  }

  store(doc: UpstreamDocument | null, id: UpstreamIdentity, realm: string) {
    this.generationCounter++;
    let originalRealm = typeof id === 'string' ? realm : id.originalRealm;
    let localId = typeof id === 'string' ? id : id.localId;
    let key = [realm, originalRealm, localId].map(encodeURIComponent).join('/');
    this._store.set(key, {
      id: {
        realm,
        originalRealm,
        localId,
      },
      doc,
      generation: this.generationCounter,
    });
  }

  entriesNewerThan(realmURL: string, generation = -Infinity): StoreEntry[] {
    return [...this._store.entries()]
      .filter(([key]) => key.indexOf(encodeURIComponent(realmURL)) === 0)
      .filter(([, entry]) => entry.generation > generation)
      .map(([, entry]) => entry);
  }
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    ephemeralStorage: EphemeralStorage;
  }
}
