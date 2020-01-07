import { AddressableCard, CardId, Card, canonicalURL } from './card';
import { Query } from './query';
import { myOrigin } from './origin';
import { WriterFactory } from './writer';
import { testCard } from './node-tests/test-card';
import { CARDSTACK_PUBLIC_REALM } from './realm';
import { IndexerFactory } from './indexer';
import { ScopedCardService } from './cards-service';
import * as FieldHooks from './field-hooks';

async function ephemeralRealms(cards: ScopedCardService) {
  return [
    // The realm card for the meta realm
    await cards.instantiate(
      testCard()
        .withAutoAttributes({
          csRealm: `${myOrigin}/api/realms/meta`,
          csOriginalRealm: `${myOrigin}/api/realms/meta`,
          csId: `${myOrigin}/api/realms/meta`,
        })
        .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'ephemeral-realm' }).jsonapi
    ),
    await cards.instantiate(
      testCard()
        .withAutoAttributes({
          csRealm: `${myOrigin}/api/realms/meta`,
          csOriginalRealm: `${myOrigin}/api/realms/meta`,
          csId: `${myOrigin}/api/realms/first-ephemeral-realm`,
        })
        .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'ephemeral-realm' }).jsonapi
    ),
    await cards.instantiate(
      testCard()
        .withAutoAttributes({
          csRealm: `${myOrigin}/api/realms/meta`,
          csOriginalRealm: `http://example.com/api/realms/meta`,
          csId: `http://example.com/api/realms/second-ephemeral-realm`,
        })
        .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'ephemeral-realm' }).jsonapi
    ),
  ];
}

export async function search(query: Query, cards: ScopedCardService): Promise<AddressableCard[] | null> {
  // this is currently special-cased to only handle searches for realms.
  // Everything else throws unimplemented.

  if (!query.filter || !('eq' in query.filter)) {
    return null;
  }

  if (query.filter.eq.csRealm !== `${myOrigin}/api/realms/meta`) {
    return null;
  }

  let allRealms = await ephemeralRealms(cards);
  if ('csId' in query.filter.eq) {
    let searchingFor = query.filter.eq.csId;
    return allRealms.filter(card => card.csId === searchingFor);
  } else {
    return allRealms;
  }
}

export async function get(id: CardId, cards: ScopedCardService): Promise<AddressableCard | null> {
  let allRealms = await ephemeralRealms(cards);
  let found = allRealms.find(r => r.canonicalURL === canonicalURL(id));
  if (found) {
    return found;
  }

  return null;
}

export async function loadFeature(card: Card, featureName: any): Promise<any> {
  switch (featureName) {
    case 'writer':
      return await loadWriter(card);
    case 'indexer':
      return await loadIndexer(card);
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

async function loadWriter(card: Card): Promise<WriterFactory | undefined> {
  if (card.canonicalURL === canonicalURL({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'ephemeral-realm' })) {
    return (await import('./ephemeral/writer')).default;
  }
  return undefined;
}

async function loadIndexer(card: Card): Promise<IndexerFactory<unknown> | undefined> {
  if (card.canonicalURL === canonicalURL({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'ephemeral-realm' })) {
    return (await import('./ephemeral/indexer')).default as IndexerFactory<unknown>;
  }
  return undefined;
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
  if (card.canonicalURL === canonicalURL({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'integer-field' })) {
    return {
      validate: async (value: string, _fieldCard: Card) => {
        return typeof value === 'number' && value === Math.floor(value) && value < Number.MAX_SAFE_INTEGER;
      },
      deserialize: async (value: string, _fieldCard: Card) => {
        return value;
      },
    };
  }
  return null;
}
