import Card from "./card";
import { Query, FieldFilter } from './cards-service';
import CardstackError from "./error";
import { myOrigin } from "./origin";
import { CARDSTACK_PUBLIC_REALM } from "./realm";

export async function search(query: Query): Promise<Card[]> {
  // this is currently special-cased to only handle searches for realms.
  // Everything else throws unimplemented.

  if (!query.filter?.every || query.filter.every.length !== 2) {
    throw new CardstackError("unimplemented, not an every");
  }

  let searchingInMetaRealm = false;
  for (let f of query.filter.every) {
    if (
      f.fieldName === "realm" &&
      f.value === `${myOrigin}/api/realms/meta`
    ) {
      searchingInMetaRealm = true;
      break;
    }
  }

  if (!searchingInMetaRealm) {
    throw new CardstackError("unimplemented, not searching in meta realm");
  }

  let foundRealmId: FieldFilter | null = null;
  for (let f of query.filter.every) {
    if (
      f.fieldName === "local-id" &&
      f.cardId.realm.href === CARDSTACK_PUBLIC_REALM.href &&
      f.cardId.localId === "realm"
    ) {
      foundRealmId = f;
    }
  }

  if (!foundRealmId || typeof foundRealmId.value !== "string") {
    throw new CardstackError("unimplemented, not searching for realm localId");
  }

  return [
    new Card({
      data: {
        type: "cards",
        id: `a-fake-realm`,
        attributes: {
          realm: `${myOrigin}/api/realms/meta`,
          'original-realm': `${myOrigin}/api/realms/meta`,
          'local-id': foundRealmId.value,
          model: {
            attributes: {
              repo: 'git+https://github.com/ef4/ember-animated'
            },
          }
        },
        relationships: {
          "adopts-from": {
            links: {
              related: 'https://base.cardstack.com/api/realms/public/cards/git'
            },
          }
        }
      }
    })
  ];
}
