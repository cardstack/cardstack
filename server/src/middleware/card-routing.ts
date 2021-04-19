import { ServerKoa } from '../interfaces';
import type Router from '@koa/router';
import { respondWithCardForPath } from '../routes/card-route';
import { encodeCardURL } from '@cardstack/core/src/utils';

export async function setupCardRouting(
  app: ServerKoa,
  router: Router,
  options: { routeCard: string }
) {
  let { routeCard } = options;
  // Prime the route card cache if needed
  await app.context.builder.getCompiledCard(routeCard);

  const CardRouterClass = (
    await import(`@cardstack/compiled/${encodeCardURL(routeCard)}`)
  ).default;

  app.context.cardRouter = new CardRouterClass();

  router.get('/cardFor/:pathname', respondWithCardForPath);
}
