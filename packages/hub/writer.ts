import { Session } from './session';
import { UpstreamDocument, UpstreamIdentity } from './document';
import { AddressableCard } from './card';

export interface WriterFactory {
  new (realmCard: AddressableCard): Writer;
}

export interface Writer {
  create(
    session: Session,
    doc: UpstreamDocument,
    id: UpstreamIdentity | null
  ): Promise<{ saved: UpstreamDocument; id: UpstreamIdentity }>;

  update(session: Session, id: UpstreamIdentity, doc: UpstreamDocument): Promise<UpstreamDocument>;

  delete(session: Session, id: UpstreamIdentity, version: string | number): Promise<void>;
}
