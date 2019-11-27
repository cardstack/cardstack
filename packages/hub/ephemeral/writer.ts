import { Writer } from '../writer';
import { Session } from '../session';
import { UpstreamDocument } from '../document';

export default class EphemeralWriter implements Writer {
  async create(_session: Session, doc: UpstreamDocument) {
    return doc;
  }
}
