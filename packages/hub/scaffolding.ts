import { CardWithId, Card, CardId } from './card';
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
    new CardWithId(
      testCard({
        csRealm: `${myOrigin}/api/realms/meta`,
        csOriginalRealm: `${myOrigin}/api/realms/meta`,
        csLocalId: `${myOrigin}/api/realms/meta`,
      }).jsonapi
    ),
    new CardWithId(
      testCard({
        csRealm: `${myOrigin}/api/realms/meta`,
        csOriginalRealm: `${myOrigin}/api/realms/meta`,
        csLocalId: `${myOrigin}/api/realms/first-ephemeral-realm`,
      }).jsonapi
    ),
    new CardWithId(
      testCard({
        csRealm: `${myOrigin}/api/realms/meta`,
        csOriginalRealm: `http://example.com/api/realms/meta`,
        csLocalId: `http://example.com/api/realms/second-ephemeral-realm`,
      }).jsonapi
    ),
    new CardWithId(
      testCard({
        csRealm: `${myOrigin}/api/realms/meta`,
        csOriginalRealm: CARDSTACK_PUBLIC_REALM,
        csLocalId: CARDSTACK_PUBLIC_REALM,
      }).jsonapi
    ),
  ];
}

export async function search(query: Query): Promise<CardWithId[] | null> {
  // this is currently special-cased to only handle searches for realms.
  // Everything else throws unimplemented.

  if (!query.filter || !('eq' in query.filter)) {
    return null;
  }

  if (query.filter.eq.realm !== `${myOrigin}/api/realms/meta` || !('local-id' in query.filter.eq)) {
    return null;
  }

  let searchingFor = query.filter.eq['local-id'];
  return ephemeralRealms().filter(card => card.localId === searchingFor);
}

export async function get(id: CardId): Promise<CardWithId | null> {
  if (
    id.realm === 'https://base.cardstack.com/public' &&
    (id.originalRealm ?? id.realm) === 'https://base.cardstack.com/public' &&
    id.localId === 'string-field'
  ) {
    return new CardWithId(
      testCard({
        csRealm: id.realm,
        csOriginalRealm: id.originalRealm,
        csLocalId: id.localId,
      }).jsonapi
    );
  }
  return null;
}

export async function loadWriter(card: CardWithId): Promise<WriterFactory> {
  if (ephemeralRealms().find(realm => realm.id === card.id)) {
    return (await import('./ephemeral/writer')).default;
  }
  throw new Error(`unimplemented`);
}

export async function loadIndexer(card: CardWithId): Promise<IndexerFactory<unknown>> {
  if (ephemeralRealms().find(realm => realm.id === card.id)) {
    return (await import('./ephemeral/indexer')).default as IndexerFactory<unknown>;
  }
  throw new Error(`unimplemented`);
}

export async function validate(_oldCard: CardWithId | null, _newCard: Card | null, _realm: CardWithId): Promise<void> {}

export function patch(target: SingleResourceDoc, source: SingleResourceDoc) {
  return merge(target, source);
}

export function buildValueExpression(expression: CardExpression): CardExpression {
  return expression;
}
