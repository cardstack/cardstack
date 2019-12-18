import { Card, UnsavedCard, CardId } from './card';
import { Query } from './query';
import { myOrigin } from './origin';
import { WriterFactory } from './writer';
import { SingleResourceDoc } from 'jsonapi-typescript';
import merge from 'lodash/merge';
import { testCard } from './node-tests/test-card';
import { CardExpression } from './pgsearch/util';
import { CARDSTACK_PUBLIC_REALM } from './realm';
import { IndexerFactory } from './indexer';

function ephemeralRealms() {
  return [
    // The realm card for the meta realm
    new Card(
      testCard({
        csRealm: `${myOrigin}/api/realms/meta`,
        csOriginalRealm: `${myOrigin}/api/realms/meta`,
        csLocalId: `${myOrigin}/api/realms/meta`,
      }).jsonapi
    ),
    new Card(
      testCard({
        csRealm: `${myOrigin}/api/realms/meta`,
        csOriginalRealm: `${myOrigin}/api/realms/meta`,
        csLocalId: `${myOrigin}/api/realms/first-ephemeral-realm`,
      }).jsonapi
    ),
    new Card(
      testCard({
        csRealm: `${myOrigin}/api/realms/meta`,
        csOriginalRealm: `http://example.com/api/realms/meta`,
        csLocalId: `http://example.com/api/realms/second-ephemeral-realm`,
      }).jsonapi
    ),
    new Card(
      testCard({
        csRealm: `${myOrigin}/api/realms/meta`,
        csOriginalRealm: CARDSTACK_PUBLIC_REALM,
        csLocalId: CARDSTACK_PUBLIC_REALM,
      }).jsonapi
    ),
  ];
}

export async function search(query: Query): Promise<Card[] | null> {
  // this is currently special-cased to only handle searches for realms.
  // Everything else throws unimplemented.

  if (!query.filter || !('eq' in query.filter)) {
    return null;
  }

  if (query.filter.eq.realm !== `${myOrigin}/api/realms/meta` || !('localId' in query.filter.eq)) {
    return null;
  }

  let searchingFor = query.filter.eq.localId;
  return ephemeralRealms().filter(card => card.localId === searchingFor);
}

export async function get(id: CardId): Promise<Card | null> {
  if (
    id.realm === 'https://base.cardstack.com/public' &&
    (id.originalRealm ?? id.realm) === 'https://base.cardstack.com/public' &&
    id.localId === 'string-field'
  ) {
    return new Card(
      testCard({
        csRealm: id.realm,
        csOriginalRealm: id.originalRealm,
        csLocalId: id.localId,
      }).jsonapi
    );
  }
  return null;
}

export async function loadWriter(card: Card): Promise<WriterFactory> {
  if (ephemeralRealms().find(realm => realm.id === card.id)) {
    return (await import('./ephemeral/writer')).default;
  }
  throw new Error(`unimplemented`);
}

export async function loadIndexer(card: Card): Promise<IndexerFactory<unknown>> {
  if (ephemeralRealms().find(realm => realm.id === card.id)) {
    return (await import('./ephemeral/indexer')).default as IndexerFactory<unknown>;
  }
  throw new Error(`unimplemented`);
}

export async function validate(_oldCard: Card | null, _newCard: UnsavedCard | null, _realm: Card): Promise<void> {}

export function patch(target: SingleResourceDoc, source: SingleResourceDoc) {
  return merge(target, source);
}

export function buildValueExpression(expression: CardExpression): CardExpression {
  return expression;
}
