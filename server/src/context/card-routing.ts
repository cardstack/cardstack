import { ServerKoa } from '../interfaces';
import type Router from '@koa/router';
import { respondWithCardForPath } from '../routes/card-route';

const ROUTER_METHOD_NAME = 'routeTo';

function assertValidRouterInstance(router: any, routeCard: string): void {
  if (typeof router[ROUTER_METHOD_NAME] !== 'function') {
    throw new Error(
      `Route Card's Schema does not have proper routing method defined. 
      Please make sure ${routeCard} schema has a ${ROUTER_METHOD_NAME} method`
    );
  }
}

export async function setupCardRouting(
  app: ServerKoa,
  koaRouter: Router,
  options: { routeCard: string; cardCacheDir: string }
) {
  let { routeCard, cardCacheDir } = options;
  let { modelModule } = await app.context.builder.getCompiledCard(routeCard);

  const cardRouterClassLocation = require.resolve(modelModule, {
    paths: [cardCacheDir],
  });
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const CardRouterClass = require(cardRouterClassLocation).default;
  const cardRouterInstance = new CardRouterClass();

  assertValidRouterInstance(cardRouterInstance, routeCard);

  app.context.cardRouter = cardRouterInstance;

  koaRouter.get('/cardFor/:pathname', respondWithCardForPath);
}
