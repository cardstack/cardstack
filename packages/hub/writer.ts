import { Session } from "./session";
import { UpstreamDocument } from "./document";

export interface WriterFactory {
  new(): Writer;
}

export interface Pending<Meta = {}> {
  originalDocument?: UpstreamDocument;
  finalDocument?: UpstreamDocument;
  finalize(): Promise<Meta>;
}

export interface Writer<Meta = {}> {
  prepareCreate(session: Session, doc: UpstreamDocument): Promise<Pending<Meta>>;
}
