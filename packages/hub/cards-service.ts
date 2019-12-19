import { Session } from './session';
import { UnsavedCard, Card, CardId, canonicalURLToCardId } from './card';
import { CARDSTACK_PUBLIC_REALM } from './realm';
import CardstackError from './error';
import { myOrigin } from './origin';
import { search as scaffoldSearch, get as scaffoldGet } from './scaffolding';
import { getOwner, inject } from './dependency-injection';
import { SingleResourceDoc } from 'jsonapi-typescript';
import { Query } from './query';
import { ResponseMeta } from './pgsearch/pgclient';
import { Writer } from './writer';
import { validate } from './validation';

export default class CardsService {
  pgclient = inject('pgclient');

  as(session: Session) {
    return new ScopedCardService(this, session);
  }
}

export class ScopedCardService {
  constructor(private cards: CardsService, private session: Session) {}

  instantiate(jsonapi: SingleResourceDoc): Card {
    return new Card(jsonapi, this);
  }

  async create(realm: string, doc: SingleResourceDoc): Promise<Card> {
    let realmCard = await this.getRealm(realm);
    let writer = await this.loadWriter(realmCard);
    let card: UnsavedCard = new UnsavedCard(doc, realm, this);
    await validate(null, card, realmCard);

    let upstreamIdToWriter = card.upstreamId;
    let { saved, id: upstreamIdFromWriter } = await writer.create(
      this.session,
      await card.asUpstreamDoc(),
      upstreamIdToWriter
    );
    if (upstreamIdToWriter && upstreamIdFromWriter !== upstreamIdToWriter) {
      throw new CardstackError(`Writer plugin for realm ${realm} tried to change a csId it's not allowed to change`);
    }
    card.csId = typeof upstreamIdFromWriter === 'object' ? upstreamIdFromWriter.csId : upstreamIdFromWriter;
    let savedCard = card.asSavedCard();
    savedCard.patch(saved.jsonapi);

    let batch = this.cards.pgclient.beginCardBatch(this);
    await batch.save(savedCard);
    await batch.done();

    return savedCard;
  }

  async delete(id: CardId, version: string | number): Promise<void>;
  async delete(canonicalURL: string, version: string | number): Promise<void>;
  async delete(idOrURL: CardId | string, version: string | number): Promise<void> {
    let id = asCardId(idOrURL);
    let realmCard = await this.getRealm(id.csRealm);
    let writer = await this.loadWriter(realmCard);
    let card = await this.get(id);
    await validate(card, null, realmCard);

    await writer.delete(this.session, card.upstreamId, version);
    let batch = this.cards.pgclient.beginCardBatch(this);
    await batch.delete(id);
    await batch.done();
  }

  async search(query: Query): Promise<{ cards: Card[]; meta: ResponseMeta }> {
    let cards = await scaffoldSearch(query, this);
    if (cards) {
      return { cards, meta: { page: { total: cards.length } } };
    }

    let { cards: foundCards, meta } = await this.cards.pgclient.search(this, query);
    return { cards: foundCards, meta };
  }

  async get(id: CardId): Promise<Card>;
  async get(canonicalURL: string): Promise<Card>;
  async get(idOrURL: CardId | string): Promise<Card> {
    // this exists to throw if there's no such realm. We're not using the return
    // value yet but we will onc we implement custom searchers and realm grants.
    let id = asCardId(idOrURL);
    await this.getRealm(id.csRealm);
    let card = await scaffoldGet(id, this);
    if (card) {
      return card;
    }
    // TODO dont create a scoped card service here
    return await this.cards.pgclient.get(this, id);
  }

  private async loadWriter(realmCard: Card): Promise<Writer> {
    let writerFactory = await realmCard.loadFeature('writer');
    if (!writerFactory) {
      throw new CardstackError(`realm "${realmCard.canonicalURL}" is not writable`, {
        status: 403,
      });
    }
    return await getOwner(this.cards).instantiate(writerFactory, realmCard);
  }

  private async getRealm(realm: string): Promise<Card> {
    // This searches by realm and csId. Even though it doesn't search by
    // originalRealm, it's unique because of the special property that Realm
    // cards have that their csId contains the complete URL to the realm. So
    // csIds created on different hubs will never collide.
    //
    // We don't necessarily know the originalRealm we're looking for because we
    // don't know whose meta realm this realm was originally created in.
    let { cards: realms } = await this.cards.as(Session.INTERNAL_PRIVILEGED).search({
      filter: {
        type: { csRealm: CARDSTACK_PUBLIC_REALM, csId: 'realm' },
        eq: {
          // the special meta-realm on each origin has restrictive but not
          // entirely closed off permissions that let users create / update /
          // delete their own Realm cards. The set of relam cards in the
          // meta-realm determines all the realms this hub (origin) knows
          // about. Some of the realms in here can live on other origins, and
          // that's fine.
          csRealm: `${myOrigin}/api/realms/meta`,
          csId: realm,
        },
      },
    });

    if (realms.length === 0) {
      throw new CardstackError(`no such realm`, { status: 400 });
    }
    return realms[0];
  }
}

function asCardId(idOrURL: CardId | string): CardId {
  if (typeof idOrURL === 'string') {
    return canonicalURLToCardId(idOrURL);
  } else {
    return idOrURL;
  }
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    cards: CardsService;
  }
}
