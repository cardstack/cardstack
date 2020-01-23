import { Writer } from '@cardstack/core/lib/writer';
import { Session } from '@cardstack/hub/session';
import { UpstreamDocument, UpstreamIdentity } from '@cardstack/core/lib/document';
import { inject } from '@cardstack/hub/dependency-injection';
import { AddressableCard } from '@cardstack/core/lib/card';
import CardstackError from '@cardstack/core/lib/error';

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
    let version = doc.jsonapi.data.meta?.version;
    if (version == null) {
      throw new CardstackError('missing required field "meta.version"', {
        status: 400,
        source: { pointer: '/data/meta/version' },
      });
    }

    return this.ephemeralStorage.store(doc, id, this.realmCard.csId, String(version))!;
  }

  async delete(_session: Session, id: UpstreamIdentity, version: string | number) {
    this.ephemeralStorage.store(null, id, this.realmCard.csId, version);
  }
}
