import { UpstreamDocument, UpstreamIdentity } from '../document';

export class EphemeralStorage {
  private _identity = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  private generationCounter = 0;
  private store = new Map() as Map<string, UpstreamDocument>;

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
    this.store.set(key, doc);
  }

  // TODO ultimately you will probably want something that only gets the latest generation of cards
  allCards(realmURL: string): UpstreamDocument[] {
    return [...this.store.entries()]
      .filter(([key]) => key.indexOf(encodeURIComponent(realmURL)) === 0)
      .map(([, doc]) => doc);
  }
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    ephemeralStorage: EphemeralStorage;
  }
}
