import { Session } from './session';
import { UnsavedCard, AddressableCard, Card, CardId, canonicalURLToCardId } from './card';
import { CARDSTACK_PUBLIC_REALM } from './realm';
import CardstackError from './error';
import { myOrigin } from './origin';
import { search as scaffoldSearch, get as scaffoldGet } from './scaffolding';
import { getOwner, inject } from './dependency-injection';
import { SingleResourceDoc } from 'jsonapi-typescript';
import { Query } from './query';
import { ResponseMeta } from './pgsearch/pgclient';
import { Writer } from './writer';

export default class CardsService {
  pgclient = inject('pgclient');

  as(session: Session) {
    return new ScopedCardService(this, session);
  }
}

export class ScopedCardService {
  constructor(private cards: CardsService, private session: Session) {}

  instantiate(jsonapi: SingleResourceDoc): AddressableCard;
  instantiate(jsonapi: SingleResourceDoc, enclosingCard: Card): Card;
  instantiate(jsonapi: SingleResourceDoc, enclosingCard?: Card): AddressableCard | Card {
    if (enclosingCard) {
      return new Card(jsonapi, enclosingCard.csRealm, this);
    } else {
      return new AddressableCard(jsonapi, this);
    }
  }

  async create(realm: string, doc: SingleResourceDoc): Promise<AddressableCard> {
    let realmCard = await this.getRealm(realm);
    let writer = await this.loadWriter(realmCard);
    let card: UnsavedCard = new UnsavedCard(doc, realm, this);
    await card.validate(null, realmCard);

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
    let savedCard = card.asAddressableCard();
    savedCard.patch(saved.jsonapi);

    let batch = this.cards.pgclient.beginCardBatch(this);
    await batch.save(savedCard);
    await batch.done();

    return savedCard;
  }

  async update(id: CardId, doc: SingleResourceDoc): Promise<AddressableCard>;
  async update(canonicalURL: string, doc: SingleResourceDoc): Promise<AddressableCard>;
  async update(idOrURL: CardId | string, doc: SingleResourceDoc): Promise<AddressableCard> {
    let id = asCardId(idOrURL);
    let realmCard = await this.getRealm(id.csRealm);
    let writer = await this.loadWriter(realmCard);
    let previousCard = await this.get(id);
    let updatedCard = previousCard.clone();
    updatedCard.patch(doc);
    await updatedCard.validate(previousCard, realmCard);

    let saved = await writer.update(this.session, updatedCard.upstreamId, await updatedCard.asUpstreamDoc());
    updatedCard.patch(saved.jsonapi);

    let batch = this.cards.pgclient.beginCardBatch(this);
    await batch.save(updatedCard);
    await batch.done();

    return updatedCard;
  }

  async delete(id: CardId, version: string | number): Promise<void>;
  async delete(canonicalURL: string, version: string | number): Promise<void>;
  async delete(idOrURL: CardId | string, version: string | number): Promise<void> {
    let id = asCardId(idOrURL);
    let realmCard = await this.getRealm(id.csRealm);
    let writer = await this.loadWriter(realmCard);
    let card = await this.get(id);
    await card.validate(null, realmCard, true);

    await writer.delete(this.session, card.upstreamId, version);
    let batch = this.cards.pgclient.beginCardBatch(this);
    await batch.delete(id);
    await batch.done();
  }

  async search(query: Query): Promise<{ cards: AddressableCard[]; meta: ResponseMeta }> {
    let cards = await scaffoldSearch(query, this);
    if (cards) {
      return { cards, meta: { page: { total: cards.length } } };
    }

    let { cards: foundCards, meta } = await this.cards.pgclient.search(this, query);
    return { cards: foundCards, meta };
  }

  async get(id: CardId): Promise<AddressableCard>;
  async get(canonicalURL: string): Promise<AddressableCard>;
  async get(idOrURL: CardId | string): Promise<AddressableCard> {
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

  private async loadWriter(realmCard: AddressableCard): Promise<Writer> {
    let writerFactory = await realmCard.loadFeature('writer');
    if (!writerFactory) {
      throw new CardstackError(`realm "${realmCard.canonicalURL}" is not writable`, {
        status: 403,
      });
    }
    return await getOwner(this.cards).instantiate(writerFactory, realmCard);
  }

  private async getRealm(realm: string): Promise<AddressableCard> {
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
