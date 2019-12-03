import { CardWithId, Card } from "./card";
import { Query, EqFilter } from "./cards-service";
import CardstackError from "./error";
import { myOrigin } from "./origin";
import { CARDSTACK_PUBLIC_REALM } from "./realm";
import { WriterFactory } from "./writer";
import { SingleResourceDoc } from "jsonapi-typescript";
import merge from "lodash/merge";
import { testCard } from "./node-tests/test-card";

function ephemeralRealms() {
  return [
    new CardWithId(
      testCard(
        {
          realm: `${myOrigin}/api/realms/meta`,
          originalRealm: `${myOrigin}/api/realms/meta`,
          localId: `${myOrigin}/api/realms/first-ephemeral-realm`
        },
        {}
      ).jsonapi
    ),
    new CardWithId(
      testCard(
        {
          realm: `${myOrigin}/api/realms/meta`,
          originalRealm: `http://example.com/api/realms/meta`,
          localId: `http://example.com/api/realms/second-ephemeral-realm`,
        },
        {}
      ).jsonapi
    )
  ];
}

export async function search(query: Query): Promise<CardWithId[]> {
  // this is currently special-cased to only handle searches for realms.
  // Everything else throws unimplemented.

  if (!query.filter || !('every' in query.filter) || query.filter.every.length !== 2) {
    throw new CardstackError("unimplemented, not an every");
  }

  let searchingInMetaRealm = false;
  for (let f of query.filter.every) {
    if ('eq' in f && f.fieldName === "realm" && f.eq === `${myOrigin}/api/realms/meta`) {
      searchingInMetaRealm = true;
      break;
    }
  }

  if (!searchingInMetaRealm) {
    throw new CardstackError("unimplemented, not searching in meta realm");
  }

  let foundRealmId: EqFilter | null = null;
  for (let f of query.filter.every) {
    if (
      'eq' in f &&
      f.fieldName === "local-id" &&
      f.cardId.realm.href === CARDSTACK_PUBLIC_REALM.href &&
      f.cardId.localId === "realm"
    ) {
      foundRealmId = f;
    }
  }

  if (!foundRealmId || typeof foundRealmId.eq !== "string") {
    throw new CardstackError("unimplemented, not searching for realm localId");
  }
  let searchingFor = foundRealmId.eq;
  return ephemeralRealms().filter(card => card.localId === searchingFor);
}

export async function loadWriter(card: CardWithId): Promise<WriterFactory> {
  if (ephemeralRealms().find(realm => realm.id === card.id)) {
    return (await import("./ephemeral/writer")).default;
  }
  throw new Error(`unimplemented`);
}

export async function validate(
  _oldCard: CardWithId | null,
  _newCard: Card | null,
  _realm: CardWithId
): Promise<void> {}

export function patch(target: SingleResourceDoc, source: SingleResourceDoc) {
  return merge(target, source);
}
