import { SingleResourceDoc, CollectionResourceDoc } from 'jsonapi-typescript';

export class PristineDocument {
  kind = 'pristine';
  constructor(public jsonapi: SingleResourceDoc) {}
}

export class PristineCollection {
  kind = 'pristine-collection';
  constructor(public jsonapi: CollectionResourceDoc) {}
}

export class UpstreamDocument {
  kind = 'upstream';
  constructor(public jsonapi: SingleResourceDoc) {}
}

export type UpstreamIdentity = { originalRealm: string; localId: string } | string;

export class SearchDocument {
  kind = 'search';
  constructor(public jsonapi: SingleResourceDoc) {}
}
