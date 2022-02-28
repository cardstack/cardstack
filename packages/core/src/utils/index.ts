import flow from 'lodash/flow';
import upperFirst from 'lodash/upperFirst';
import camelCase from 'lodash/camelCase';
import { CardId } from '../interfaces';

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

export function cardURL(card: CardId): string {
  return `${card.realm}${card.id}`;
}

export function keys<Obj>(o: Obj): (keyof Obj)[] {
  return Object.keys(o) as (keyof Obj)[];
}
