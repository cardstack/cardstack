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
            value: { origin: myOrigin, id: 'meta-realm'},
          },
          {
            cardId: { realm: CARDSTACK_PUBLIC_REALM, id: "realm" }, // <- "search for id fields on realm cards"
            fieldName: "id",
            value: `${realm.origin}/${realm.id}`,
          },
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

  async search(_session: Session, query: SearchQuery): Promise<Card[]> {
    if (!query.filter) {
      throw new CardstackError('unimplemented');
    }

    return [];
  }
}

interface SearchQuery {
  filter?: EveryCondition | SearchCondition;
}

interface EveryCondition {
  every: SearchCondition[];
}

interface SearchCondition {
  cardId: CardId;
  fieldName: string;
  value: any;
}

declare module "@cardstack/hub/dependency-injection" {
  interface KnownServices {
    cards: CardsService;
  }
}
