import { Writer } from '../writer';
import { Session } from '../session';
import { UpstreamDocument, UpstreamIdentity } from '../document';
import { inject } from '../dependency-injection';
import { Card } from '../card';

let counter = 0;

export default class EphemeralWriter implements Writer {
  ephemeralStorage = inject('ephemeralStorage');

  constructor(private realmCard: Card) {}

  async create(_session: Session, doc: UpstreamDocument, upstreamId: UpstreamIdentity | null) {
    let id = upstreamId ?? String(counter++);
    let saved = this.ephemeralStorage.store(doc, id, this.realmCard.csId);
    return { saved: saved!, id };
  }

  async delete(_session: Session, id: UpstreamIdentity, version: string | number) {
    let csOriginalRealm, csId;
    if (typeof id === 'string') {
      csId = id;
      csOriginalRealm = this.realmCard.csId;
    } else {
      ({ csId, csOriginalRealm } = id);
    }
    this.ephemeralStorage.store(null, { csOriginalRealm, csId }, this.realmCard.csId, version);
  }
}
