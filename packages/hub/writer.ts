import { Session } from "./session";
import { UpstreamDocument } from "./document";

export interface WriterFactory {
  new(): Writer;
}

export interface Writer {
  create(session: Session, doc: UpstreamDocument): Promise<UpstreamDocument>;
}
