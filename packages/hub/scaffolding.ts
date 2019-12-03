import { CardWithId, Card } from "./card";
import { Query } from "./cards-service";
import CardstackError from "./error";
import { myOrigin } from "./origin";
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

  if (!query.filter || !('eq' in query.filter)) {
    throw new CardstackError("unimplemented, not an eq");
  }

  if (query.filter.eq.realm !== `${myOrigin}/api/realms/meta` || !('local-id' in query.filter.eq)) {
    throw new CardstackError("unimplemented, not searching in meta realm");
  }

  let searchingFor = query.filter.eq['local-id'];
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
