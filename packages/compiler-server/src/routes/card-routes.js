"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cardRoutes = void 0;
const errors_1 = require("../middleware/errors");
const serialization_1 = require("../utils/serialization");
const routes_1 = require("../utils/routes");
const interfaces_1 = require("@cardstack/core/src/interfaces");
const router_1 = __importDefault(require("@koa/router"));
async function getCard(ctx) {
    let { builder, realms, params: { encodedCardURL: url }, } = ctx;
    let format = routes_1.getCardFormatFromRequest(ctx.query.format);
    let rawCard = await realms.getRawCard(url);
    let card = await builder.getCompiledCard(url);
    ctx.body = await serialization_1.serializeCard(url, rawCard.data, card[format]);
    ctx.status = 200;
}
async function createDataCard(ctx) {
    let { builder, realms, request: { body }, params: { parentCardURL, realmURL }, } = ctx;
    if (typeof body === 'string') {
        throw new Error('Request body is a string and it shouldnt be');
    }
    interfaces_1.assertValidKeys(Object.keys(body), ['adoptsFrom', 'data', 'url'], 'Payload contains keys that we do not allow: %list%');
    let data = body.data;
    let rawCard = await realms.getRealm(realmURL).createDataCard(data.attributes, parentCardURL, data.id);
    let compiledCard = await builder.getCompiledCard(rawCard.url);
    let format = routes_1.getCardFormatFromRequest(ctx.query.format);
    ctx.body = await serialization_1.serializeCard(compiledCard.url, rawCard.data, compiledCard[format]);
    ctx.status = 201;
}
async function updateCard(ctx) {
    let { builder, realms, request: { body }, params: { encodedCardURL: url }, } = ctx;
    let data = await serialization_1.deserialize(body);
    let rawCard = await realms.updateCardData(url, data.attributes);
    let card = await builder.getCompiledCard(url);
    // Question: Is it safe to assume the response should be isolated?
    ctx.body = await serialization_1.serializeCard(url, rawCard.data, card['isolated']);
    ctx.status = 200;
}
async function deleteCard(ctx) {
    let { realms, params: { encodedCardURL: url }, } = ctx;
    if (!realms.doesCardExist(url)) {
        throw new errors_1.NotFound(`Card ${url} does not exist`);
    }
    realms.deleteCard(url);
    ctx.status = 204;
    ctx.body = null;
}
function assertValidRouterInstance(router, routeCard) {
    const ROUTER_METHOD_NAME = 'routeTo';
    if (typeof router[ROUTER_METHOD_NAME] !== 'function') {
        throw new Error(`Route Card's Schema does not have proper routing method defined.
      Please make sure ${routeCard} schema has a ${ROUTER_METHOD_NAME} method`);
    }
}
async function respondWithCardForPath(ctx) {
    let { builder, realms, cardRouter, params: { pathname }, } = ctx;
    if (!cardRouter) {
        throw Error('Card routing not configured for this server');
    }
    let url = cardRouter.routeTo(pathname);
    if (!url) {
        throw new errors_1.NotFound(`No card defined for route ${pathname}`);
    }
    let rawCard = await realms.getRawCard(url);
    let card = await builder.getCompiledCard(url);
    ctx.body = await serialization_1.serializeCard(url, rawCard.data, card['isolated']);
    ctx.status = 200;
}
async function setupCardRouting(context, options) {
    let { routeCard } = options;
    let card = await context.builder.getCompiledCard(routeCard);
    const CardRouterClass = context.requireCard(card.schemaModule).default;
    const cardRouterInstance = new CardRouterClass();
    assertValidRouterInstance(cardRouterInstance, routeCard);
    context.cardRouter = cardRouterInstance;
}
function unimpl() {
    throw new Error('unimplemented');
}
async function getSource(ctx) {
    let { realms, builder, params: { encodedCardURL: url }, query, } = ctx;
    let compiledCard;
    let rawCard = await realms.getRawCard(url);
    if (query.include === 'compiledMeta') {
        compiledCard = await builder.getCompiledCard(url);
    }
    ctx.body = serialization_1.serializeRawCard(rawCard, compiledCard);
}
async function cardRoutes(context, routeCard) {
    if (routeCard) {
        await setupCardRouting(context, { routeCard });
    }
    let koaRouter = new router_1.default();
    // the 'cards' section of the API deals in card data. The shape of the data
    // on these endpoints is determined by each card's own schema.
    koaRouter.post(`/cards/:realmURL/:parentCardURL`, createDataCard);
    koaRouter.get(`/cards/:encodedCardURL`, getCard);
    koaRouter.patch(`/cards/:encodedCardURL`, updateCard);
    koaRouter.delete(`/cards/:encodedCardURL`, deleteCard);
    // the 'sources' section of the API deals in RawCards. It's where you can do
    // CRUD operations on the sources themselves. It's a superset of what you
    // can do via the 'cards' section.
    koaRouter.post(`/sources/new`, unimpl);
    koaRouter.get(`/sources/:encodedCardURL`, getSource);
    koaRouter.patch(`/sources/:encodedCardURL`, unimpl);
    koaRouter.delete(`/sources/:encodedCardURL`, unimpl);
    // card-based routing is a layer on top of the 'cards' section where you can
    // fetch card data indirectly.
    koaRouter.get('/cardFor/:pathname', respondWithCardForPath);
    return koaRouter;
}
exports.cardRoutes = cardRoutes;
//# sourceMappingURL=card-routes.js.map