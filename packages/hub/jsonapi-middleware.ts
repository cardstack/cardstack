import compose from 'koa-compose';
import route, { KoaRoute } from 'koa-better-route';
import Koa from 'koa';
// @ts-ignore
import mimeMatch from 'mime-match';
import KoaBody from 'koa-body';
import { Memoize } from 'typescript-memoize';
import { inject } from './dependency-injection';
import CardstackError from './error';
import { SessionContext } from './authentication-middleware';
import { assertSingleResourceDoc } from './document';
import { myOrigin } from './origin';
import { Card } from './card';
import { SingleResourceDoc } from 'jsonapi-typescript';
import { parse } from 'qs';
import { assertQuery } from './query';

const apiPrefix = '/api';
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
      // repeat for patch
      // repeat for delete
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
    ctxt.body = (await card.asPristineDoc()).jsonapi;
    ctxt.status = 201;
    ctxt.set('location', this.localURLFor(card));
  }

  async getCard(ctxt: KoaRoute.Context<SessionContext, {}>) {
    let realm: string;
    if (ctxt.routeParams.local_realm_id != null) {
      realm = `${myOrigin}${apiPrefix}/realms/${ctxt.routeParams.local_realm_id}`;
    } else if (ctxt.routeParams.remote_realm_url) {
      realm = ctxt.routeParams.remote_realm_url;
    } else {
      throw new CardstackError(`bug in jsonapi-middleware: missing realm parameter in getCard`, { status: 500 });
    }

    let originalRealm: string;
    if (ctxt.routeParams.original_realm_url != null) {
      originalRealm = ctxt.routeParams.original_realm_url;
    } else {
      originalRealm = realm;
    }

    let localId: string;
    if (ctxt.routeParams.local_id != null) {
      localId = ctxt.routeParams.local_id;
    } else {
      throw new CardstackError(`bug in jsonapi-middleware: missing localId parameter in getCard`, { status: 500 });
    }

    let card = await this.cards.as(ctxt.state.cardstackSession).get({ realm, originalRealm, localId });
    ctxt.body = (await card.asPristineDoc()).jsonapi;
    ctxt.status = 200;
  }

  async getCards(ctxt: KoaRoute.Context<SessionContext, {}>) {
    let query = parse(ctxt.request.querystring, { plainObjects: true });
    assertQuery(query);

    let { cards, meta } = await this.cards.as(ctxt.state.cardstackSession).search(query);
    let collection = await Card.makePristineCollection(cards, meta);
    ctxt.body = collection.jsonapi;
    ctxt.status = 200;
  }

  private localURLFor(card: Card): string {
    let isHome = card.originalRealm === card.realm;
    if (new URL(card.realm).origin === myOrigin) {
      let base = `${myOrigin}${apiPrefix}/realms`;
      let localRealmId = card.realm.slice(base.length + 1);
      if (isHome) {
        return [base, localRealmId, 'cards', card.localId].join('/');
      } else {
        return [base, localRealmId, 'cards', encodeURIComponent(card.originalRealm), card.localId].join('/');
      }
    } else {
      let base = `${myOrigin}${apiPrefix}/remote-realms`;
      if (isHome) {
        return [base, encodeURIComponent(card.realm), 'cards', card.localId].join('/');
      } else {
        return [
          base,
          encodeURIComponent(card.realm),
          'cards',
          encodeURIComponent(card.originalRealm),
          card.localId,
        ].join('/');
      }
    }
  }
}

declare module '@cardstack/hub/dependency-injection' {
  interface KnownServices {
    'jsonapi-middleware': JSONAPIMiddleware;
  }
}
