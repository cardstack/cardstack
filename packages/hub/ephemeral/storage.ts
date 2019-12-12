import { UpstreamDocument, UpstreamIdentity } from '../document';

export class EphemeralStorage {
  store = new Map() as Map<string, UpstreamDocument>;

  save(doc: UpstreamDocument, id: UpstreamIdentity, realmURL: string) {
    let key = [realmURL, typeof id === 'string' ? realmURL : id.originalRealm, typeof id === 'string' ? id : id.localId]
      .map(encodeURIComponent)
      .join('/');
    this.store.set(key, doc);
  }

  // TODO ultimately you will probably want something that only gets the latest generation of cards
  allCards(): UpstreamDocument[] {
    return [...this.store.values()];
  }
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    ephemeralStorage: EphemeralStorage;
  }
}
