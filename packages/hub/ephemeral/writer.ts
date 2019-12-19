import { Writer } from '../writer';
import { Session } from '../session';
import { UpstreamDocument, UpstreamIdentity } from '../document';
import { inject } from '../dependency-injection';
import { Card, CardId } from '../card';

let counter = 0;

export default class EphemeralWriter implements Writer {
  ephemeralStorage = inject('ephemeralStorage');

  constructor(private realmCard: Card) {}

  async create(_session: Session, doc: UpstreamDocument, upstreamId: UpstreamIdentity | null) {
    let id = upstreamId ?? String(counter++);
    let saved = this.ephemeralStorage.store(doc, id, this.realmCard.localId);
    return { saved: saved!, id };
  }

  async delete(_session: Session, id: CardId, version: string | number) {
    let { realm, originalRealm, localId } = id;
    originalRealm = originalRealm ?? realm;
    this.ephemeralStorage.store(null, { originalRealm, localId }, realm, version);
  }
}
