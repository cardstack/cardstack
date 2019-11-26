import { Writer } from '../writer';
import { Session } from '../session';
import { UpstreamDocument } from '../document';

export default class EphemeralWriter implements Writer {
  async prepareCreate(_session: Session, doc: UpstreamDocument) {
    return {
      finalDocument: doc,
      async finalize() {
        return { version: 'x' };
      }
    };
  }
}
