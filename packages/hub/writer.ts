import { Session } from './session';
import { UpstreamDocument, UpstreamIdentity } from './document';
import { CardWithId } from './card';

export interface WriterFactory {
  new (realmCard: CardWithId): Writer;
}

export interface Writer {
  create(
    session: Session,
    doc: UpstreamDocument,
    id: UpstreamIdentity | null
  ): Promise<{ saved: UpstreamDocument; id: UpstreamIdentity }>;
}
