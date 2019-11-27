import { Writer } from '../writer';
import { Session } from '../session';
import { UpstreamDocument, UpstreamIdentity } from '../document';

let counter = 0;

export default class EphemeralWriter implements Writer {
  async create(_session: Session, doc: UpstreamDocument, upstreamId: UpstreamIdentity | null) {
    let id = upstreamId ?? String(counter++);
    return { saved: doc, id };
  }
}
