import { SingleResourceDoc } from "jsonapi-typescript";
import Session from "./session";
import Card, { CardId } from "./card";
import { CARDSTACK_PUBLIC_REALM } from "./realm";
import CardstackError from "./error";
import { myOrigin } from "./origin";

export default class CardsService {
  async create(
    _session: Session,
    realm: URL,
    _doc: SingleResourceDoc
  ): Promise<Card> {
    let realms = await this.search(Session.INTERNAL_PRIVILEGED, {
      filter: {
        every: [
          {
            cardId: { realm: CARDSTACK_PUBLIC_REALM, localId: "base" },
            fieldName: "realm",

            // the special meta-realm on each origin has restrictive but not
            // entirely closed off permissions that let users create / update /
            // delete their own Realm cards. The set of relam cards in the
            // meta-realm determines all the realms this hub (origin) knows
            // about. Some of the realms in here can live on other origins, and
            // that's fine.
            value: `${myOrigin}/api/realms/meta`
          },
          {
            // within cards that adopt from our base realm card:
            cardId: { realm: CARDSTACK_PUBLIC_REALM, localId: "realm" },

            // search their local-id fields:
            fieldName: "local-id",

            // for this value
            value: realm.href,
          }
        ]
      }
    });

    if (realms.length === 0) {
      throw new CardstackError(`no such realm`, { status: 400 });
    }

    return realms[0];
  }

  async search(_session: Session, query: Query): Promise<Card[]> {
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
              attributes: {},
              relationships: {
                "realm-type": {
                  data: {
                    type: "cards",
                    id: 'stubbed-git-card',
                  }
                }
              }
            }
          },
          relationships: {
            "adopts-from": {
              data: {
                type: "cards",
                id: 'stubbed-base-realm-card',
              }
            }
          }
        }
      })
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
