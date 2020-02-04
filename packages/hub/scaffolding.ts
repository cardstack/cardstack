import { AddressableCard } from '@cardstack/core/card';
import { CardId, canonicalURL } from '@cardstack/core/card-id';
import { Query } from '@cardstack/core/query';
import { myOrigin } from '@cardstack/core/origin';
import { cardDocument } from '@cardstack/core/card-document';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';
import { ScopedCardService } from './cards-service';

async function ephemeralRealms(cards: ScopedCardService) {
  return [
    // The realm card for the meta realm
    await cards.instantiate(
      cardDocument()
        .withAutoAttributes({
          csRealm: `${myOrigin}/api/realms/meta`,
          csOriginalRealm: `${myOrigin}/api/realms/meta`,
          csId: `${myOrigin}/api/realms/meta`,
        })
        .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'ephemeral-realm' }).jsonapi
    ),
    await cards.instantiate(
      cardDocument()
        .withAutoAttributes({
          csRealm: `${myOrigin}/api/realms/meta`,
          csOriginalRealm: `${myOrigin}/api/realms/meta`,
          csId: `${myOrigin}/api/realms/first-ephemeral-realm`,
        })
        .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'ephemeral-realm' }).jsonapi
    ),
    await cards.instantiate(
      cardDocument()
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
