import { AddressableCard, CardId, Card, canonicalURL } from './card';
import { Query } from './query';
import { myOrigin } from './origin';
import { WriterFactory } from './writer';
import { testCard } from './node-tests/test-card';
import { CARDSTACK_PUBLIC_REALM } from './realm';
import { IndexerFactory } from './indexer';
import { ScopedCardService } from './cards-service';
import * as FieldHooks from './field-hooks';

function ephemeralRealms(cards: ScopedCardService) {
  return [
    // The realm card for the meta realm
    cards.instantiate(
      testCard().withAutoAttributes({
        csRealm: `${myOrigin}/api/realms/meta`,
        csOriginalRealm: `${myOrigin}/api/realms/meta`,
        csId: `${myOrigin}/api/realms/meta`,
      }).jsonapi
    ),
    cards.instantiate(
      testCard().withAutoAttributes({
        csRealm: `${myOrigin}/api/realms/meta`,
        csOriginalRealm: `${myOrigin}/api/realms/meta`,
        csId: `${myOrigin}/api/realms/first-ephemeral-realm`,
      }).jsonapi
    ),
    cards.instantiate(
      testCard().withAutoAttributes({
        csRealm: `${myOrigin}/api/realms/meta`,
        csOriginalRealm: `http://example.com/api/realms/meta`,
        csId: `http://example.com/api/realms/second-ephemeral-realm`,
      }).jsonapi
    ),
    cards.instantiate(
      testCard().withAutoAttributes({
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
  let coreFieldTypes = ['string-field', 'boolean-field'];
  if (
    id.csRealm === 'https://base.cardstack.com/public' &&
    (id.csOriginalRealm ?? id.csRealm) === 'https://base.cardstack.com/public' &&
    coreFieldTypes.includes(id.csId)
  ) {
    return cards.instantiate(
      testCard().withAutoAttributes({
        csRealm: id.csRealm,
        csOriginalRealm: id.csOriginalRealm,
        csId: id.csId,
      }).jsonapi
    );
  }
  return null;
}

export async function loadFeature(card: Card, cards: ScopedCardService, featureName: any): Promise<any> {
  switch (featureName) {
    case 'writer':
      return await loadWriter(card, cards);
    case 'indexer':
      return await loadIndexer(card, cards);
    case 'field-validate':
      return (await loadFieldHooks(card))?.validate;
    case 'field-deserialize':
      return (await loadFieldHooks(card))?.deserialize;
    case 'field-buildQueryExpression':
      return (await loadFieldHooks(card))?.buildQueryExpression;
    case 'field-buildValueExpression':
      return (await loadFieldHooks(card))?.buildValueExpression;
    default:
      throw new Error(`unimplemented loadFeature("${featureName}")`);
  }
}

async function loadWriter(card: Card, cards: ScopedCardService): Promise<WriterFactory> {
  if (ephemeralRealms(cards).find(realm => realm.canonicalURL === card.canonicalURL)) {
    return (await import('./ephemeral/writer')).default;
  }
  throw new Error(`unimplemented`);
}

async function loadIndexer(card: Card, cards: ScopedCardService): Promise<IndexerFactory<unknown>> {
  if (ephemeralRealms(cards).find(realm => realm.canonicalURL === card.canonicalURL)) {
    return (await import('./ephemeral/indexer')).default as IndexerFactory<unknown>;
  }
  throw new Error(`unimplemented`);
}

async function loadFieldHooks(
  card: Card
): Promise<{
  validate?: FieldHooks.validate<string>;
  deserialize?: FieldHooks.deserialize<string, string>;
  buildQueryExpression?: FieldHooks.buildQueryExpression;
  buildValueExpression?: FieldHooks.buildValueExpression;
} | null> {
  if (card.canonicalURL === canonicalURL({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'string-field' })) {
    return {
      validate: async (value: string, _fieldCard: Card) => {
        return typeof value === 'string';
      },
      deserialize: async (value: string, _fieldCard: Card) => {
        return value;
      },
    };
  }
  if (card.canonicalURL === canonicalURL({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'boolean-field' })) {
    return {
      validate: async (value: string, _fieldCard: Card) => {
        return typeof value === 'boolean';
      },
      deserialize: async (value: string, _fieldCard: Card) => {
        return value;
      },
    };
  }
  return null;
}
