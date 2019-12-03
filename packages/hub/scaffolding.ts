import { CardWithId, Card } from "./card";
import { Query, FieldFilter } from "./cards-service";
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

  if (!query.filter?.every || query.filter.every.length !== 2) {
    throw new CardstackError("unimplemented, not an every");
  }

  let searchingInMetaRealm = false;
  for (let f of query.filter.every) {
    if (f.fieldName === "realm" && f.value === `${myOrigin}/api/realms/meta`) {
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
  let searchingFor = foundRealmId.value;
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
