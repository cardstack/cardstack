import { Writer } from '../writer';
import { Session } from '../session';
import { UpstreamDocument, UpstreamIdentity } from '../document';
import { inject } from '../dependency-injection';
import { CardWithId } from '../card';

let counter = 0;

export default class EphemeralWriter implements Writer {
  ephemeralStorage = inject('ephemeralStorage');

  constructor(private realmCard: CardWithId) {
  }

  async create(_session: Session, doc: UpstreamDocument, upstreamId: UpstreamIdentity | null) {
    let id = upstreamId ?? String(counter++);
    this.ephemeralStorage.save(doc, id, this.realmCard.localId);
    return { saved: doc, id };
  }
}
