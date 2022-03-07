import flow from 'lodash/flow';
import upperFirst from 'lodash/upperFirst';
import camelCase from 'lodash/camelCase';
import { CardId, CompiledCard, GlobalRef, Saved } from '../interfaces';
import { CardstackError } from './errors';

const SPECIAL_CHAR_REPLACEMENT = '-';

export const classify = flow(camelCase, upperFirst);

export function encodeCardURL(url: string): string {
  return url
    .replace(/\/$/, '') // No need for trailing slashes
    .replace('://', SPECIAL_CHAR_REPLACEMENT)
    .replace(/([;,/?:@&=+$])/g, SPECIAL_CHAR_REPLACEMENT);
}

export function ensureTrailingSlash(p: string): string {
  return p.replace(/\/$/, '') + '/';
}

export function removeTrailingSlash(p: string): string {
  return p.replace(/\/$/, '');
}

export function getBasenameAndExtension(filename: string): {
  basename: string;
  extension: string;
} {
  let extensionMatch = filename.match(/\.[^/.]+$/);
  let extension = extensionMatch ? extensionMatch[0] : '';
  let basename = filename.replace(extension, '');

  return { basename, extension };
}

export function getCardAncestor(
  parentCard: CompiledCard<Saved, GlobalRef>,
  url: string
): CompiledCard<Saved, GlobalRef> {
  if (parentCard.url === url) {
    return parentCard;
  } else if (parentCard.adoptsFrom) {
    return getCardAncestor(parentCard.adoptsFrom, url);
  }

  throw new CardstackError(`Tried to find a card ancestory for ${url}, but could not`);
}

export function resolveCard(url: string, realm: string): string {
  let base = ensureTrailingSlash(realm) + 'PLACEHOLDER/';
  let resolved = new URL(url, base).href;
  if (resolved.startsWith(base)) {
    throw new CardstackError(`${url} resolves to a local file within a card, but it should resolve to a whole card`);
  }
  return resolved;
}

const DUMMY_PREFIX = 'http://test/';
export function resolveModule(path: string, base: string): string {
  // This is a workaround to resolve module paths, ie: @cardstack/compiled/https....
  return new URL(path, `${DUMMY_PREFIX}${base}`).href.replace(DUMMY_PREFIX, '');
}

export function cardURL(card: CardId): string {
  return `${card.realm}${card.id}`;
}

export function keys<Obj>(o: Obj): (keyof Obj)[] {
  return Object.keys(o) as (keyof Obj)[];
}
