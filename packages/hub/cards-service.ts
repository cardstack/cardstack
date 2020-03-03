import { Session } from '@cardstack/core/session';
import { UnsavedCard, AddressableCard, Card } from '@cardstack/core/card';
import { asCardId, CardId } from '@cardstack/core/card-id';
import { CARDSTACK_PUBLIC_REALM } from '@cardstack/core/realm';
import { ResponseMeta } from '@cardstack/core/document';
import CardstackError from '@cardstack/core/error';
import { myOrigin } from '@cardstack/core/origin';
import { getOwner, inject } from './dependency-injection';
import { SingleResourceDoc } from 'jsonapi-typescript';
import { Query } from '@cardstack/core/query';
import { Writer } from '@cardstack/core/writer';
import { join } from 'path';
import { assertSingleResourceDoc } from './jsonapi';
import merge from 'lodash/merge';
import { readdirSync, existsSync, statSync, readFileSync } from 'fs-extra';
import { CardReader } from '@cardstack/core/card-reader';
import { CardInstantiator } from '@cardstack/core/card-instantiator';
import { cardDocument } from '@cardstack/core/card-document';

export default class CardsService {
  pgclient = inject('pgclient');

  as(session: Session) {
    return new ScopedCardService(this, session);
  }
}

export class ScopedCardService implements CardReader, CardInstantiator {
  constructor(private cards: CardsService, private session: Session) {}

  async instantiate(jsonapi: SingleResourceDoc, imposeIdentity?: CardId): Promise<AddressableCard> {
    let moduleLoader = await getOwner(this.cards).lookup('modules');
    return await getOwner(this.cards).instantiate(
      AddressableCard,
      jsonapi,
      this,
      moduleLoader,
      getOwner(this.cards),
      imposeIdentity
    );
  }

  async create(realm: string, doc: SingleResourceDoc): Promise<AddressableCard> {
    let moduleLoader = await getOwner(this.cards).lookup('modules');
    let realmCard = await this.getRealm(realm);
    let writer = await this.loadWriter(realmCard);
    let card: UnsavedCard = await getOwner(this.cards).instantiate(
      UnsavedCard,
      doc,
      realm,
      this,
      moduleLoader,
      getOwner(this.cards),
      this
    );
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

    let csId = typeof upstreamIdFromWriter === 'object' ? upstreamIdFromWriter.csId : upstreamIdFromWriter;
    let savedCard = await card.asAddressableCard(merge(saved.jsonapi, { data: { attributes: { csId } } }));
    let batch = this.cards.pgclient.beginCardBatch(this);
    await batch.save(savedCard);
    await batch.done();

    return savedCard;
  }

  async update(id: CardId, doc: SingleResourceDoc): Promise<AddressableCard>;
  async update(canonicalURL: string, doc: SingleResourceDoc): Promise<AddressableCard>;
  async update(idOrURL: CardId | string, doc: SingleResourceDoc): Promise<AddressableCard> {
    let id = asCardId(idOrURL);
    if (!doc.data.attributes) {
      doc.data.attributes = {};
    }
    doc.data.attributes.csUpdated = new Date().toISOString();
    let realmCard = await this.getRealm(id.csRealm);
    let writer = await this.loadWriter(realmCard);
    let previousCard = await this.get(id);
    let updatedCard = await previousCard.patch(doc);
    await updatedCard.validate(previousCard, realmCard);

    let saved = await writer.update(this.session, updatedCard.upstreamId, await updatedCard.asUpstreamDoc());
    updatedCard = await updatedCard.patch(saved.jsonapi);

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
    let { cards: foundCards, meta } = await this.cards.pgclient.search(this, query);
    return { cards: foundCards, meta };
  }

  async get(id: CardId): Promise<AddressableCard>;
  async get(canonicalURL: string): Promise<AddressableCard>;
  async get(idOrURL: CardId | string): Promise<AddressableCard> {
    let id = asCardId(idOrURL);

    if (
      id.csRealm === CARDSTACK_PUBLIC_REALM &&
      (!id.csOriginalRealm || id.csOriginalRealm === CARDSTACK_PUBLIC_REALM)
    ) {
      return await this.getBuiltIn(id);
    }

    // this exists to throw if there's no such realm. We're not using the return
    // value yet but we will onc we implement custom searchers and realm grants.
    await this.getRealm(id.csRealm);

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

    // In the scenario where we are trying to create the meta realm, we need to
    // actually have builtin meta realm that exists as a bridge to allow us to
    // create a meta realm. In that case we'll return a one-time temp ephemeral
    // based meta realm. After our actual meta realm has been created via the
    // process, we can use the real one.
    if (realms.length === 0 && realm === `${myOrigin}/api/realms/meta`) {
      return await this.getTempMetaRealm();
    } else if (realms.length === 0) {
      throw new CardstackError(`no such realm "${realm}"`, { status: 400 });
    }

    return realms[0];
  }

  // This is only used as a bridge to creating the _actual_ meta realm (breaks
  // the chicken/egg problem)
  private async getTempMetaRealm() {
    return this.instantiate(
      cardDocument()
        .withAutoAttributes({
          csRealm: `${myOrigin}/api/realms/meta`,
          csId: `${myOrigin}/api/realms/meta`,
        })
        .adoptingFrom({ csRealm: CARDSTACK_PUBLIC_REALM, csId: 'ephemeral-realm' }).jsonapi
    );
  }

  private async getBuiltIn(id: CardId): Promise<AddressableCard> {
    let cardDir = join(__dirname, '..', '..', 'cards', id.csId);
    if (!existsSync(cardDir)) {
      throw new CardstackError(`Card '${id.csId}' not found in public realm`, { status: 404 });
    }
    // @ts-ignore
    let json = await import(join(cardDir, 'card.json'));
    assertSingleResourceDoc(json);

    // ensure we have an attributes object
    merge(json, {
      data: {
        attributes: {},
        meta: {
          cardDir,
        },
      },
    });

    // then ensure that csFiles reflects our true on disk files only
    json.data.attributes!.csFiles = walkFiles(cardDir);

    // and our peerDeps match the ones from package.json
    // @ts-ignore
    json.data.attributes!.csPeerDependencies = (await import(join(cardDir, 'package.json'))).peerDependencies;

    return await this.instantiate(json, id);
  }
}

function walkFiles(dir: string): NonNullable<Card['csFiles']> {
  let output = Object.create(null) as ReturnType<typeof walkFiles>;
  let names = readdirSync(dir);
  for (let name of names) {
    let fullName = join(dir, name);
    let stat = statSync(fullName);
    if (stat.isDirectory()) {
      output[name] = walkFiles(fullName);
    } else {
      output[name] = readFileSync(fullName, 'utf8');
    }
  }
  return output;
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    cards: CardsService;
  }
}
