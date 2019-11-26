import { SingleResourceDoc } from "jsonapi-typescript";
import Session from "./session";
import Card, { CardId } from "./card";
import { Realm, CARDSTACK_PUBLIC_REALM } from "./realm";
import CardstackError from "./error";
import { myOrigin } from "./origin";

export default class CardsService {
  async create(
    _session: Session,
    realm: Realm,
    doc: SingleResourceDoc
  ): Promise<Card> {
    let realms = await this.search(Session.INTERNAL_PRIVILEGED, {
      filter: {
        every: [
          {
            cardId: { realm: CARDSTACK_PUBLIC_REALM, id: "base" },
            fieldName: "realm",

            // the special meta-realm on each origin has restrictive but not
            // entirely closed off permissions that let users create / update /
            // delete their own Realm cards. The set of relam cards in the
            // meta-realm determines all the realms this hub (origin) knows
            // about. Some of the realms in here can live on other origins, and
            // that's fine.
            value: { origin: myOrigin, id: "meta-realm" }
          },
          {
            cardId: { realm: CARDSTACK_PUBLIC_REALM, id: "realm" }, // <- "search for id fields on realm cards"
            fieldName: "id",
            value: `${realm.origin}/${realm.id}`
          }
        ]
      }
    });

    if (realms.length === 0) {
      throw new CardstackError(`no such realm`, { status: 400 });
    }

    return {
      realm,
      id: String(Math.floor(Math.random() * 1000)),
      jsonapi: doc
    };
  }

  async search(_session: Session, query: Query): Promise<Card[]> {
    // this is currently special-cased to only handle searches for realms.
    // Everything else throws unimplemented.

    if (!query.filter?.every || query.filter.every.length !== 2) {
      throw new CardstackError("unimplemented");
    }

    let foundMetaRealm = false;
    for (let f of query.filter.every) {
      if (
        f.fieldName === "realm" &&
        f.value?.origin === myOrigin &&
        f.value?.id === "meta-realm"
      ) {
        foundMetaRealm = true;
        break;
      }
    }

    if (!foundMetaRealm) {
      throw new CardstackError("unimplemented");
    }

    let foundRealmId: FieldFilter | null = null;
    for (let f of query.filter.every) {
      if (
        f.fieldName === "id" &&
        f.cardId.realm.id === CARDSTACK_PUBLIC_REALM.id &&
        f.cardId.realm.origin === CARDSTACK_PUBLIC_REALM.origin &&
        f.cardId.id === "realm"
      ) {
        foundRealmId = f;
      }
    }

    if (!foundRealmId || typeof foundRealmId.value !== "string") {
      throw new CardstackError("unimplemented");
    }

    return [
      {
        realm: { origin: myOrigin, id: "meta-realm" },
        id: foundRealmId.value,
        jsonapi: {
          data: {
            type: "cards",
            id: `${myOrigin}/meta-realm/${foundRealmId.value}`,
            attributes: {
              model: {
                attributes: {

                },
                relationships: {
                  'realm-type': {
                    data: {
                      type: 'cards',
                      id: `${CARDSTACK_PUBLIC_REALM.origin}/${CARDSTACK_PUBLIC_REALM.id}/git`,
                    }
                  }
                }
              }
            },
            relationships: {
              "adopts-from": {
                data: {
                  type: "cards",
                  id: `${CARDSTACK_PUBLIC_REALM.origin}/${CARDSTACK_PUBLIC_REALM.id}/realm`
                }
              }
            }
          }
        }
      }
    ];
  }
}

interface Query {
  filter?: Filter;
}

type Filter = AnyFilter | EveryFilter | NotFilter | FieldFilter;

// The explicitly undefined types below may look funny, but they make it legal
// to check the presence of the special marker `any`, `every`, `fieldName`, and
// `not` properties on every kind of Filter.

interface AnyFilter {
  any: Filter[];
  every?: undefined;
  fieldName?: undefined;
  not?: undefined;
}

interface EveryFilter {
  any?: undefined;
  every: Filter[];
  fieldName?: undefined;
  not?: undefined;
}

interface NotFilter {
  any?: undefined;
  every?: undefined;
  fieldName?: undefined;
  not: Filter;
}

interface FieldFilter {
  any?: undefined;
  every?: undefined;
  not?: undefined;
  cardId: CardId;
  fieldName: string;
  value: any;
}

declare module "@cardstack/hub/dependency-injection" {
  interface KnownServices {
    cards: CardsService;
  }
}
