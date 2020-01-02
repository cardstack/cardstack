import { AddressableCard, CardId } from './card';
import { Query } from './query';
import { myOrigin } from './origin';
import { WriterFactory } from './writer';
import { testCard } from './node-tests/test-card';
import { CardExpression } from './pgsearch/util';
import { CARDSTACK_PUBLIC_REALM } from './realm';
import { IndexerFactory } from './indexer';
import { ScopedCardService } from './cards-service';

function ephemeralRealms(cards: ScopedCardService) {
  return [
    // The realm card for the meta realm
    cards.instantiate(
      testCard().withAttributes({
        csRealm: `${myOrigin}/api/realms/meta`,
        csOriginalRealm: `${myOrigin}/api/realms/meta`,
        csId: `${myOrigin}/api/realms/meta`,
      }).jsonapi
    ),
    cards.instantiate(
      testCard().withAttributes({
        csRealm: `${myOrigin}/api/realms/meta`,
        csOriginalRealm: `${myOrigin}/api/realms/meta`,
        csId: `${myOrigin}/api/realms/first-ephemeral-realm`,
      }).jsonapi
    ),
    cards.instantiate(
      testCard().withAttributes({
        csRealm: `${myOrigin}/api/realms/meta`,
        csOriginalRealm: `http://example.com/api/realms/meta`,
        csId: `http://example.com/api/realms/second-ephemeral-realm`,
      }).jsonapi
    ),
    cards.instantiate(
      testCard().withAttributes({
        csRealm: `${myOrigin}/api/realms/meta`,
        csOriginalRealm: CARDSTACK_PUBLIC_REALM,
        csId: CARDSTACK_PUBLIC_REALM,
      }).jsonapi
    ),
  ];
}

export async function search(query: Query, cards: ScopedCardService): Promise<AddressableCard[] | null> {
  // this is currently special-cased to only handle searches for realms.
  // Everything else throws unimplemented.

  if (!query.filter || !('eq' in query.filter)) {
    return null;
  }

  if (query.filter.eq.csRealm !== `${myOrigin}/api/realms/meta` || !('csId' in query.filter.eq)) {
    return null;
  }

  let searchingFor = query.filter.eq.csId;
  return ephemeralRealms(cards).filter(card => card.csId === searchingFor);
}

export async function get(id: CardId, cards: ScopedCardService): Promise<AddressableCard | null> {
  if (
    id.csRealm === 'https://base.cardstack.com/public' &&
    (id.csOriginalRealm ?? id.csRealm) === 'https://base.cardstack.com/public' &&
    id.csId === 'string-field'
  ) {
    return cards.instantiate(
      testCard().withAttributes({
        csRealm: id.csRealm,
        csOriginalRealm: id.csOriginalRealm,
        csId: id.csId,
      }).jsonapi
    );
  }
  return null;
}

export async function loadWriter(card: AddressableCard, cards: ScopedCardService): Promise<WriterFactory> {
  if (ephemeralRealms(cards).find(realm => realm.canonicalURL === card.canonicalURL)) {
    return (await import('./ephemeral/writer')).default;
  }
  throw new Error(`unimplemented`);
}

export async function loadIndexer(card: AddressableCard, cards: ScopedCardService): Promise<IndexerFactory<unknown>> {
  if (ephemeralRealms(cards).find(realm => realm.canonicalURL === card.canonicalURL)) {
    return (await import('./ephemeral/indexer')).default as IndexerFactory<unknown>;
  }
  throw new Error(`unimplemented`);
}

export function buildValueExpression(expression: CardExpression): CardExpression {
  return expression;
}
