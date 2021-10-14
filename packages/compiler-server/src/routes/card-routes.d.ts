/// <reference types="koa__router" />
import { CardStackContext } from '@cardstack/compiler-server/src/interfaces';
import Router from '@koa/router';
export declare function cardRoutes(context: CardStackContext, routeCard: string | undefined): Promise<Router<{}, CardStackContext>>;
