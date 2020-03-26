import { Session } from './session';
import { UnsavedCard, AddressableCard, Card } from './card';
import { asCardId, CardId, canonicalURL } from './card-id';
import { CARDSTACK_PUBLIC_REALM } from './realm';
import { ResponseMeta } from './document';
import { CardstackError } from './error';
import { myOrigin } from './origin';
import { getOwner, inject } from './dependency-injection';
import { SingleResourceDoc } from 'jsonapi-typescript';
import { Query } from './query';
import { Writer } from './writer';
import { join } from 'path';
import { assertSingleResourceDoc } from './jsonapi';
import merge from 'lodash/merge';
import { readdirSync, existsSync, statSync, readFileSync } from 'fs-extra';
import { CardReader } from './card-reader';
import { CardInstantiator } from './card-instantiator';

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
    let realmCard = await this.getRealm(realm, doc);
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
    let csRealm = realmCard.csId;
    let savedCard = await card.asAddressableCard(merge(saved.jsonapi, { data: { attributes: { csId, csRealm } } }));
    let batch = this.cards.pgclient.beginCardBatch(this);
    await batch.save(savedCard);
    await batch.done();

    return savedCard;
  }

  async update(id: CardId, doc: SingleResourceDoc): Promise<AddressableCard>;
  async update(canonicalURL: string, doc: SingleResourceDoc): Promise<AddressableCard>;
  async update(idOrURL: CardId | string, doc: SingleResourceDoc): Promise<AddressableCard> {
    let id = asCardId(idOrURL);
    if (id.csRealm === CARDSTACK_PUBLIC_REALM) {
      throw new CardstackError(`Cannot update built-in card ${canonicalURL(id)}`, { status: 403 });
    }
    if (!doc.data.attributes) {
      doc.data.attributes = {};
    }
    doc.data.attributes.csUpdated = new Date().toISOString();
    let realmCard = await this.getRealm(id.csRealm);
    let csRealm = realmCard.csId;
    let writer = await this.loadWriter(realmCard);
    let previousCard = await this.get(id);
    let updatedCard = await previousCard.patch(merge(doc, { data: { attributes: { csRealm } } }));
    await updatedCard.validate(previousCard, realmCard);

    let saved = await writer.update(this.session, updatedCard.upstreamId, await updatedCard.asUpstreamDoc());
    updatedCard = await updatedCard.patch(merge(saved.jsonapi, { data: { attributes: { csRealm } } }));

    let batch = this.cards.pgclient.beginCardBatch(this);
    await batch.save(updatedCard);
    await batch.done();

    return updatedCard;
  }

  async delete(id: CardId, version?: string | number | undefined): Promise<void>;
  async delete(canonicalURL: string, version?: string | number | undefined): Promise<void>;
  async delete(idOrURL: CardId | string, version?: string | number | undefined): Promise<void> {
    let id = asCardId(idOrURL);
    if (id.csRealm === CARDSTACK_PUBLIC_REALM) {
      throw new CardstackError(`Cannot delete built-in card ${canonicalURL(id)}`, { status: 403 });
    }
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
  async get(id: CardId): Promise<AddressableCard>;
  async get(canonicalURL: string): Promise<AddressableCard>;
  async get(idOrURL: CardId | string): Promise<AddressableCard> {
    let id = asCardId(idOrURL);

    // We use the files realm to index the built-in cards, however, we still
    // need to leverage this.getBuiltIn() in order to actually bootstrap the
    // files realm that will be indexing the built-in cards. We need the
    // machinery of the files-realm card in order for it to index itself as well
    // as the base realm that adopts from it, and the the fields that the realm
    // card is comprised of.
    if (
      id.csRealm === CARDSTACK_PUBLIC_REALM &&
      (!id.csOriginalRealm || id.csOriginalRealm === CARDSTACK_PUBLIC_REALM)
    ) {
      return await this.getBuiltIn(id);
    }

    // this exists to throw if there's no such realm. We're not using the return
    // value yet but we will onc we implement custom searchers and realm grants.
    await this.getRealm(id.csRealm);

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

  private async getRealm(realm: string, metaRealmCard?: SingleResourceDoc): Promise<AddressableCard> {
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

    // In the scenario where we are trying to create the meta realm, the
    // document that we are trying to create is the realm that we need.
    if (
      realms.length === 0 &&
      realm === `${myOrigin}/api/realms/meta` &&
      metaRealmCard?.data.attributes?.csRealm === realm &&
      metaRealmCard?.data.attributes.csId === realm
    ) {
      return await this.instantiate(metaRealmCard);
    } else if (realms.length === 0) {
      throw new CardstackError(`no such realm "${realm}"`, { status: 400 });
    }

    return realms[0];
  }

  private async getBuiltIn(id: CardId): Promise<AddressableCard> {
    // Dont assume we are in a mono repo (this is not always the case). The
    // built in cards are npm dependencies, so search for it in the node
    // modules. Mono repos will have the benefit of symlinked packages, so we
    // are not losing anything by this approach, rather we are being
    // accomodating to hubs that have yarn installed their @cardstack deps.
    let cardDirs = require.resolve.paths(`@cardstack/${id.csId}-card`);
    let cardDir;
    for (let dir of cardDirs || []) {
      if (existsSync(`${dir}/@cardstack/${id.csId}-card`)) {
        cardDir = `${dir}/@cardstack/${id.csId}-card`;
        break;
      }
    }
    if (!cardDirs || !cardDir) {
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
      if (name !== 'node_modules') {
        output[name] = walkFiles(fullName);
      }
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
