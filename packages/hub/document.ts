import { SingleResourceDoc, CollectionResourceDoc } from 'jsonapi-typescript';
import { CardId } from './card';

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

export type UpstreamIdentity = { csOriginalRealm: string; csId: string } | string;

export function upstreamIdToCardId(upstreamId: UpstreamIdentity, csRealm: string): CardId {
  let csOriginalRealm, csId;
  if (typeof upstreamId === 'string') {
    csId = upstreamId;
    csOriginalRealm = csRealm;
  } else {
    ({ csId, csOriginalRealm } = upstreamId);
  }
  return { csRealm, csOriginalRealm, csId };
}
