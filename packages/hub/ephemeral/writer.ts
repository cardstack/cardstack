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
    this.ephemeralStorage.store(doc, id, this.realmCard.localId);
    return { saved: doc, id };
  }
}
