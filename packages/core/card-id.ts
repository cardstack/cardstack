import { UpstreamIdentity } from '@cardstack/hub';

export interface CardId {
  csRealm: string;
  csOriginalRealm?: string; // if not set, its implied that its equal to `realm`.
  csId: string;
}

export type FieldArity = 'singular' | 'plural';

export function canonicalURLToCardId(url: string): CardId {
  let parts = url.split('/');
  let csId = parts.pop()!;
  let nextPart = parts.pop()!;
  let originalRealm;
  if (nextPart !== 'cards') {
    originalRealm = nextPart;
    parts.pop();
  }
  return {
    csRealm: parts.join('/'),
    csOriginalRealm: originalRealm == null ? undefined : decodeURIComponent(originalRealm),
    csId: decodeURIComponent(csId),
  };
}

export function canonicalURL(id: CardId): string {
  let isHome = !id.csOriginalRealm || id.csOriginalRealm === id.csRealm;
  if (isHome) {
    return [id.csRealm, 'cards', encodeURIComponent(id.csId)].join('/');
  } else {
    return [
      id.csRealm,
      'cards',
      encodeURIComponent(id.csOriginalRealm ?? id.csRealm),
      encodeURIComponent(id.csId),
    ].join('/');
  }
}

export function asCardId(idOrURL: CardId | string): CardId {
  if (typeof idOrURL === 'string') {
    return canonicalURLToCardId(idOrURL);
  } else {
    return idOrURL;
  }
}

export function upstreamIdToCardDirName(upstreamId: UpstreamIdentity): string {
  if (typeof upstreamId === 'string') {
    return encodeURIComponent(upstreamId);
  } else {
    return encodeURIComponent(`${upstreamId.csOriginalRealm}_${upstreamId.csId}`);
  }
}

export const cardstackFieldPattern = /^cs[A-Z]/;
