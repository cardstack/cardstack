import { Session } from './session';
import { UpstreamDocument, UpstreamIdentity } from './document';
import { Card, CardId } from './card';

export interface WriterFactory {
  new (realmCard: Card): Writer;
}

export interface Writer {
  create(
    session: Session,
    doc: UpstreamDocument,
    id: UpstreamIdentity | null
  ): Promise<{ saved: UpstreamDocument; id: UpstreamIdentity }>;

  delete(session: Session, id: CardId, version: string | number): Promise<void>;
}
