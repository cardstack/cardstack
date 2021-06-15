import compose from 'koa-compose';
import route from 'koa-better-route';
import Koa from 'koa';
// @ts-ignore
import mimeMatch from 'mime-match';
import KoaBody from 'koa-body';
import { Memoize } from 'typescript-memoize';
import { CardstackError } from './error';
import { SessionContext } from './authentication-middleware';
import SessionRoute from './routes/session';
import { inject } from './di/dependency-injection';

const API_PREFIX = '/api';
const apiPrefixPattern = new RegExp(`^${API_PREFIX}/(.*)`);

export default class JSONAPIMiddleware {
  sessionRoute: SessionRoute = inject('session-route', { as: 'sessionRoute' });
  middleware() {
    return (ctxt: Koa.ParameterizedContext<SessionContext, Record<string, unknown>>, next: Koa.Next) => {
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
    let { sessionRoute } = this;

    return compose([
      CardstackError.withJsonErrorHandling,
      body,
      route.get('/session', sessionRoute.get.bind(sessionRoute)),
      route.post('/session', sessionRoute.post.bind(this.sessionRoute)),
    ]);
  }

  isJSONAPI(ctxt: Koa.ParameterizedContext<SessionContext, Record<string, unknown>>) {
    let contentType = ctxt.request.headers['content-type'];
    let isJsonApi = contentType && contentType.includes('application/vnd.api+json');
    let [acceptedTypes]: string[] = (ctxt.request.headers['accept'] || '').split(';');
    let types = acceptedTypes.split(',');
    let acceptsJsonApi = types.some((t) => mimeMatch(t, 'application/vnd.api+json'));
    return isJsonApi || acceptsJsonApi;
  }
}

declare module '@cardstack/hub/di/dependency-injection' {
  interface KnownServices {
    'jsonapi-middleware': JSONAPIMiddleware;
  }
}
