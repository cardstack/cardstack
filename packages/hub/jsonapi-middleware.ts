import compose from 'koa-compose';
import route, { KoaRoute } from 'koa-better-route';
import Koa from 'koa';
// @ts-ignore
import mimeMatch from 'mime-match';
import KoaBody from 'koa-body';
import { Memoize } from 'typescript-memoize';
import { inject } from './dependency-injection';
import CardstackError from '@cardstack/core/error';
import { SessionContext } from './authentication-middleware';
import { assertSingleResourceDoc } from './jsonapi';
import { myOrigin } from '@cardstack/core/origin';
import { makeCollection, apiPrefix, AddressableCard } from '@cardstack/core/card';
import { CardId } from '@cardstack/core/card-id';
import { SingleResourceDoc } from 'jsonapi-typescript';
import { parse } from 'qs';
import { assertQuery } from '@cardstack/core/query';
import { OcclusionRules, assertOcclusionRules } from '@cardstack/core/occlusion-rules';

const apiPrefixPattern = new RegExp(`^${apiPrefix}/(.*)`);

export default class JSONAPIMiddleware {
  cards = inject('cards');

  middleware() {
    return (ctxt: Koa.ParameterizedContext<SessionContext, {}>, next: Koa.Next) => {
      let m = apiPrefixPattern.exec(ctxt.request.path);
      if (!m) {
        return next();
      }
      ctxt.request.path = `/${m[1]}`;

      if (this.isJSONAPI(ctxt)) {
        return this.jsonHandlers(ctxt, next);
      } else {
        throw new CardstackError(`not implemented`);
      }
    };
  }

  @Memoize()
  get jsonHandlers() {
    let body = KoaBody({
      jsonLimit: '16mb',
      multipart: false,
      urlencoded: false,
      text: false,
      jsonStrict: true,
      onError(error: Error) {
        throw new CardstackError(`error while parsing body: ${error.message}`, { status: 400 });
      },
    });

    return compose([
      CardstackError.withJsonErrorHandling,
      body,
      route.get('/cards', this.getCards.bind(this)),
      route.post('/realms/:local_realm_id/cards', this.createCard.bind(this)),
      route.post('/remote-realms/:remote_realm_url/cards', this.createCard.bind(this)),

      route.get('/realms/:local_realm_id/cards/:local_id', this.getCard.bind(this)),
      route.get('/realms/:local_realm_id/cards/:original_realm_url/:local_id', this.getCard.bind(this)),
      route.get('/remote-realms/:remote_realm_url/cards/:local_id', this.getCard.bind(this)),
      route.get('/remote-realms/:remote_realm_url/cards/:original_realm_url/:local_id', this.getCard.bind(this)),

      route.delete('/realms/:local_realm_id/cards/:local_id', this.deleteCard.bind(this)),
      route.delete('/realms/:local_realm_id/cards/:original_realm_url/:local_id', this.deleteCard.bind(this)),
      route.delete('/remote-realms/:remote_realm_url/cards/:local_id', this.deleteCard.bind(this)),
      route.delete('/remote-realms/:remote_realm_url/cards/:original_realm_url/:local_id', this.deleteCard.bind(this)),

      route.patch('/realms/:local_realm_id/cards/:local_id', this.patchCard.bind(this)),
      route.patch('/realms/:local_realm_id/cards/:original_realm_url/:local_id', this.patchCard.bind(this)),
      route.patch('/remote-realms/:remote_realm_url/cards/:local_id', this.patchCard.bind(this)),
      route.patch('/remote-realms/:remote_realm_url/cards/:original_realm_url/:local_id', this.patchCard.bind(this)),
    ]);
  }

  isJSONAPI(ctxt: Koa.ParameterizedContext<{}, {}>) {
    let contentType = ctxt.request.headers['content-type'];
    let isJsonApi = contentType && contentType.includes('application/vnd.api+json');
    let [acceptedTypes]: string[] = (ctxt.request.headers['accept'] || '').split(';');
    let types = acceptedTypes.split(',');
    let acceptsJsonApi = types.some(t => mimeMatch(t, 'application/vnd.api+json'));
    return isJsonApi || acceptsJsonApi;
  }

  private documentFromBody(ctxt: Koa.Context): SingleResourceDoc {
    assertSingleResourceDoc(ctxt.request.body);
    return ctxt.request.body;
  }

  async createCard(ctxt: KoaRoute.Context<SessionContext, {}>) {
    let body = this.documentFromBody(ctxt);
    let realm: URL;
    if (ctxt.routeParams.local_realm_id) {
      realm = new URL(`${myOrigin}${apiPrefix}/realms/${ctxt.routeParams.local_realm_id}`);
    } else {
      realm = new URL(ctxt.routeParams.remote_realm_url);
      if (realm.origin === myOrigin) {
        throw new CardstackError(`${realm.href} is a local realm. You tried to access it via /api/remote-realms`, {
          status: 400,
        });
      }
    }
    let card = await this.cards.as(ctxt.state.cardstackSession).create(realm.href, body);
    ctxt.body = await card.serializeAsJsonAPIDoc();
    ctxt.status = 201;
    ctxt.set('location', this.localURLFor(card));
  }

  async getCard(ctxt: KoaRoute.Context<SessionContext, {}>) {
    let card = await this.cards.as(ctxt.state.cardstackSession).get(cardIdFromRoute(ctxt));
    let rules = this.occlusionRulesFromRequest(ctxt);
    ctxt.body = await card.serializeAsJsonAPIDoc(rules);
    ctxt.status = 200;
  }

  async deleteCard(ctxt: KoaRoute.Context<SessionContext, {}>) {
    let version = ctxt.header['if-match'];
    await this.cards.as(ctxt.state.cardstackSession).delete(cardIdFromRoute(ctxt), version);
    ctxt.status = 204;
  }

  async patchCard(ctxt: KoaRoute.Context<SessionContext, {}>) {
    let body = this.documentFromBody(ctxt);
    let card = await this.cards.as(ctxt.state.cardstackSession).update(cardIdFromRoute(ctxt), body);
    ctxt.body = await card.serializeAsJsonAPIDoc();
    ctxt.status = 200;
  }

  async getCards(ctxt: KoaRoute.Context<SessionContext, {}>) {
    let query = parse(ctxt.request.querystring, { plainObjects: true });
    assertQuery(query);

    let { cards, meta } = await this.cards.as(ctxt.state.cardstackSession).search(query);
    let rules = this.occlusionRulesFromRequest(ctxt);
    let collection = await makeCollection(cards, meta, rules);
    ctxt.body = collection;
    ctxt.status = 200;
  }

  private localURLFor(card: AddressableCard): string {
    if (new URL(card.csRealm).origin === myOrigin) {
      return card.canonicalURL;
    } else {
      let isHome = card.csOriginalRealm === card.csRealm;

      let base = `${myOrigin}${apiPrefix}/remote-realms`;
      if (isHome) {
        return [base, encodeURIComponent(card.csRealm), 'cards', card.csId].join('/');
      } else {
        return [
          base,
          encodeURIComponent(card.csRealm),
          'cards',
          encodeURIComponent(card.csOriginalRealm),
          card.csId,
        ].join('/');
      }
    }
  }

  private occlusionRulesFromRequest(ctxt: KoaRoute.Context<SessionContext, {}>): OcclusionRules | undefined {
    let rules = parse(ctxt.request.querystring, { plainObjects: true });
    if (rules.includeFields != null || rules.includeFieldSet != null) {
      assertOcclusionRules(rules, 'Occlusion query parameter');
      return rules;
    }
  }
}

function cardIdFromRoute(ctxt: KoaRoute.Context<SessionContext, {}>): CardId {
  let csRealm: string;
  if (ctxt.routeParams.local_realm_id != null) {
    csRealm = `${myOrigin}${apiPrefix}/realms/${ctxt.routeParams.local_realm_id}`;
  } else if (ctxt.routeParams.remote_realm_url) {
    csRealm = ctxt.routeParams.remote_realm_url;
  } else {
    throw new CardstackError(`bug in jsonapi-middleware: missing realm parameter in route`, { status: 500 });
  }

  let csOriginalRealm: string;
  if (ctxt.routeParams.original_realm_url != null) {
    csOriginalRealm = ctxt.routeParams.original_realm_url;
  } else {
    csOriginalRealm = csRealm;
  }

  let csId: string;
  if (ctxt.routeParams.local_id != null) {
    csId = ctxt.routeParams.local_id;
  } else {
    throw new CardstackError(`bug in jsonapi-middleware: missing csId parameter in route`, { status: 500 });
  }

  return { csId, csOriginalRealm, csRealm };
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    'jsonapi-middleware': JSONAPIMiddleware;
  }
}
