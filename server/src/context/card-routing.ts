import type { CardStackContext } from '../interfaces';
import type Koa from 'koa';

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
  app: Koa<any, CardStackContext>,
  options: { routeCard: string }
) {
  let { routeCard } = options;
  let card = await app.context.builder.getCompiledCard(routeCard);
  const CardRouterClass = app.context.requireCard(card.schemaModule).default;
  const cardRouterInstance = new CardRouterClass();

  assertValidRouterInstance(cardRouterInstance, routeCard);

  app.context.cardRouter = cardRouterInstance;
}
