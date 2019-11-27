import { Session } from "./session";
import { Card, CardWithId, CardId } from "./card";
import { CARDSTACK_PUBLIC_REALM } from "./realm";
import CardstackError from "./error";
import { myOrigin } from "./origin";
import { search, validate } from "./scaffolding";
import { getOwner } from './dependency-injection';
import { SingleResourceDoc } from "jsonapi-typescript";

export default class CardsService {
  async create(
    session: Session,
    realm: URL,
    doc: SingleResourceDoc
  ): Promise<CardWithId> {
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

    let writerFactory = await realms[0].loadFeature('writer');
    let writer = await getOwner(this).instantiate(writerFactory);
    let card: Card = new Card(doc, realm);
    await validate(null, card, realms[0]);
    let upstreamFromWriter = await writer.create(session, await card.asUpstreamDoc());
    card.patch(upstreamFromWriter.jsonapi);
    card.assertHasIds();
    // TODO: insert into index card.asSearchDoc()
    return card;
  }

  async search(_session: Session, query: Query): Promise<CardWithId[]> {
    return await search(query);
  }
}

export interface Query {
  filter?: Filter;
}

export type Filter = AnyFilter | EveryFilter | NotFilter | FieldFilter;

// The explicitly undefined types below may look funny, but they make it legal
// to check the presence of the special marker `any`, `every`, `fieldName`, and
// `not` properties on every kind of Filter.

export interface AnyFilter {
  any: Filter[];
  every?: undefined;
  fieldName?: undefined;
  not?: undefined;
}

export interface EveryFilter {
  any?: undefined;
  every: Filter[];
  fieldName?: undefined;
  not?: undefined;
}

export interface NotFilter {
  any?: undefined;
  every?: undefined;
  fieldName?: undefined;
  not: Filter;
}

export interface FieldFilter {
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
