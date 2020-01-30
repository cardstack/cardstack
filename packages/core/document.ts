import { SingleResourceDoc } from 'jsonapi-typescript';
import { CardId } from './card';

export class UpstreamDocument {
  kind = 'upstream';
  constructor(public jsonapi: SingleResourceDoc) {}
}

export interface ResponseMeta {
  page: { total: number; cursor?: string };
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
