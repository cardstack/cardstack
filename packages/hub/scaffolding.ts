import Card from "./card";
import { Query, FieldFilter } from "./cards-service";
import CardstackError from "./error";
import { myOrigin } from "./origin";
import { CARDSTACK_PUBLIC_REALM } from "./realm";
import { WriterFactory } from "./writer";
import { PristineDocument } from "./document";
import { SingleResourceDoc } from "jsonapi-typescript";

function ephemeralRealm() {
  return new Card(
    new PristineDocument({
      data: {
        type: "cards",
        id: `fake-realm-1`,
        attributes: {
          realm: `${myOrigin}/api/realms/meta`,
          "original-realm": `${myOrigin}/api/realms/meta`,
          "local-id": "first-ephemeral-realm"
        },
        relationships: {
          "adopts-from": {
            links: {
              related:
                "https://base.cardstack.com/api/realms/public/cards/ephemeral"
            }
          }
        }
      }
    })
  );
}

export async function search(query: Query): Promise<Card[]> {
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

  if (foundRealmId.value !== `${myOrigin}/api/realms/first-ephemeral-realm`) {
    return [];
  }

  return [ephemeralRealm()];
}

export async function loadWriter(card: Card): Promise<WriterFactory> {
  if (card.id === "fake-realm-1") {
    return (await import("./ephemeral/writer")).default;
  }
  throw new Error(`unimplemented`);
}

export async function cardToPristine(jsonapi: SingleResourceDoc, realm: URL, originalRealm: URL): Promise<PristineDocument> {
  let copied = JSON.parse(JSON.stringify(jsonapi)) as SingleResourceDoc;
  if (!copied.data.attributes) {
    copied.data.attributes = {};
  }
  copied.data.attributes.realm = realm.href;
  copied.data.attributes['original-realm'] = originalRealm.href;
  if (!copied.data.id) {
    copied.data.id = String(Math.floor(Math.random() * 1000));
  }

  if (!copied.data.attributes['local-id']) {
    copied.data.attributes['local-id'] = copied.data.id;
  }

  return new PristineDocument(copied);
}
