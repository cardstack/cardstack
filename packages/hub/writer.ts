import { Session } from "./session";
import { UpstreamDocument, UpstreamIdentity } from "./document";

export interface WriterFactory {
  new (): Writer;
}


export interface Writer {
  create(
    session: Session,
    doc: UpstreamDocument,
    id: UpstreamIdentity | null,
  ): Promise<{ saved: UpstreamDocument; id: UpstreamIdentity }>;
}
