import { Writer } from '../writer';
import { Session } from '../session';
import { UpstreamDocument, UpstreamIdentity } from '../document';
import { inject } from '../dependency-injection';
import { AddressableCard } from '../card';
import CardstackError from '../error';

let counter = 0;

export default class EphemeralWriter implements Writer {
  ephemeralStorage = inject('ephemeralStorage');

  constructor(private realmCard: AddressableCard) {}

  async create(_session: Session, doc: UpstreamDocument, upstreamId: UpstreamIdentity | null) {
    let id = upstreamId ?? String(counter++);
    let saved = this.ephemeralStorage.store(doc, id, this.realmCard.csId);
    return { saved: saved!, id };
  }

  async update(_session: Session, id: UpstreamIdentity, doc: UpstreamDocument) {
    let csOriginalRealm, csId;
    if (typeof id === 'string') {
      csId = id;
      csOriginalRealm = this.realmCard.csId;
    } else {
      ({ csId, csOriginalRealm } = id);
    }

    let version = doc.jsonapi.data.meta?.version;
    if (version == null) {
      throw new CardstackError('missing required field "meta.version"', {
        status: 400,
        source: { pointer: '/data/meta/version' },
      });
    }

    return this.ephemeralStorage.store(doc, { csOriginalRealm, csId }, this.realmCard.csId, String(version))!;
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
