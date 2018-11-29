
const { get, findIndex } = require('lodash');
const { resolveRoutingCardReplacementTags } = require('./index');

async function getPath(routeStackCards, card, routerMapByDepth) {
  if (!routeStackCards || !routeStackCards.length) { return; }
  if (card.data.type === 'spaces') { return; } // spaces content-type is unique in that it IS a path

  if (!routerMapByDepth || !card) { return; }

  let path = getCanonicalPath(routerMapByDepth, routeStackCards, card.data);
  if (path) {
    return encodeURI(path);
  }
}

function getCanonicalPath(routerMapByDepth, routeStack, card) {
  let path, currentDepth, route;
  let [ routingCard ] = routeStack;

  for (let depth of Object.keys(routerMapByDepth)) {
    currentDepth = parseInt(depth, 10);
    let router = routerMapByDepth[depth];

    route = findVanityPathRoute(router, routingCard, card);
    if (route) {
      path = route.namespacedPath;
      break;
    }

    route = findFriendlyIdBasedRoute(router, routingCard, card);
    if (route) {
      path = resolvePathRelacementTagsFromCard(route, card);
      break;
    }

    route = findIdBasedRoute(router, routingCard, card);
    if (route) {
      path = resolvePathRelacementTagsFromCard(route, card);
      break;
    }

    route = findStaticMappingRoute(router, card);
    if (route) {
      path = resolvePathRelacementTagsFromCard(route, card);
      break;
    }
  }

  // favor paths for content types that have a query-less route hanging off of them
  let querylessRoute = (routerMapByDepth[`${currentDepth + 1}`] || []).find(route => !route.query &&
    route.contentType === card.type &&
    !route.routePathSegment.includes(':'));

  if (querylessRoute) {
    path = resolvePathRelacementTagsFromCard(Object.assign({}, querylessRoute, { query: { filter: { type: { exact: ':type' }, id: { exact: ':id' } } } }), card);
  }

  if (!path) { return; }

  path = resolveRoutingCardFieldsFromPath(route, path, routeStack);
  path = path.replace(/\[([^\]]+)\]/g, (match, type) => routeStack.map(r => r.data.type).includes(type) ? '' : match); // cleanup namespace artifacts

  return path;
}

function findStaticMappingRoute(router, card) {
  for (let route of router) {
    let { path, query } = route;
    if (!path) { continue; }
    query = query || (route.contentType === card.type && route.routeStack.length ? route.routeStack[0].query : null);
    if (!query) { continue; }

    let typeReplacement = get(query, 'filter.type.exact');
    let idReplacement = get(query, 'filter.id.exact');

    if (typeReplacement && idReplacement &&
        typeReplacement.charAt(0) === ':' &&
        idReplacement.charAt(0) === ':' &&
        typeReplacement !== idReplacement &&
        path.includes(typeReplacement) &&
        path.includes(idReplacement)) {
      return route;
    }
  }
}

function findIdBasedRoute(router, routingCard, card) {
  for (let route of router) {
    let { path, query } = route;
    if (!path) { continue; }
    query = query || (route.contentType === card.type && route.routeStack.length ? route.routeStack[0].query : null);
    if (!query) { continue; }

    let resolvedQuery = JSON.parse(resolveRoutingCardReplacementTags(routingCard, JSON.stringify(query)));
    let filter = resolvedQuery.filter;
    if (!filter) { continue; }

    if (get(filter, 'type.exact') !== card.type || Object.keys(filter).length !== 2) { continue; }
    let idReplacement = get(query, 'filter.id.exact');
    if (idReplacement.charAt(0) === ':' && path.includes(idReplacement)) {
      return route;
    }
  }
}

function findFriendlyIdBasedRoute(router, routingCard, card) {
  for (let route of router) {
    let { path, query } = route;
    if (!path) { continue; }
    query = query || (route.contentType === card.type && route.routeStack.length ? route.routeStack[0].query : null);
    if (!query) { continue; }

    let resolvedQuery = JSON.parse(resolveRoutingCardReplacementTags(routingCard, JSON.stringify(query)));
    let filter = resolvedQuery.filter;
    if (!filter) { continue; }

    if (get(filter, 'type.exact') !== card.type || Object.keys(filter).length !== 2) { continue; }
    let uniqueFieldName = Object.keys(filter).find(i => i !== 'type');

    if (get(filter, `${uniqueFieldName}.exact`) === ':friendly_id' &&
        path.includes(':friendly_id')) {
      return route;
    }
  }
}

function findVanityPathRoute(router, routingCard, card) {
  for (let route of router) {
    let { path, query } = route;
    if (!path) { continue; }
    query = query || (route.contentType === card.type && route.routeStack.length ? route.routeStack[0].query : null);
    if (!query) { continue; }

    let resolvedQuery = JSON.parse(resolveRoutingCardReplacementTags(routingCard, JSON.stringify(query)));
    if (!path.includes(':') &&
        get(resolvedQuery, 'filter.type.exact') === card.type &&
        get(resolvedQuery, 'filter.id.exact') === card.id) {
      return route;
    }
  }
}

function resolvePathRelacementTagsFromCard(route, card) {
  let { query } = route;
  query = query || (route.contentType === card.type && route.routeStack.length ? route.routeStack[0].query : null);
  if (!query || !query.filter || !route.namespacedPath) { return; }

  let filter = query.filter;
  let typeReplacement = get(filter, 'type.exact');
  typeReplacement = typeReplacement.charAt(0) === ':' ? typeReplacement : null;
  let uniqueFieldName = Object.keys(filter).find(i => i !== 'type');

  let path = route.namespacedPath;
  if (typeReplacement) {
    path = path.replace(typeReplacement, card.type);
  }

  if (uniqueFieldName === 'id') {
    let idReplacement = get(filter, 'id.exact');
    path = idReplacement ? path.replace(idReplacement, card.id) : path;
  } else if (get(filter[uniqueFieldName], 'exact') === ':friendly_id') {
    path = path.replace(':friendly_id', card.attributes[uniqueFieldName]);
  }

  return path;
}

function resolveRoutingCardFieldsFromPath(route, path, routeStackCards) {
  return path.replace(/(:[^[]+)\[([^\]]+)\]/g, (match, tag, type) => {
    let routingCard = route.routeStack.find(r => r.contentType === type && r.query);
    if (!routingCard) { return match; }

    let field;
    if (get(routingCard, 'query.filter.id.exact') === tag) {
      field = 'id';
    } else if (get(routingCard, 'query.filter.type.exact') === tag) {
      field = 'type';
    } else if (tag === ':friendly_id' && Object.keys(get(routingCard, 'query.filter') || {}).length === 2) {
      field = Object.keys(routingCard.query.filter).find(k => k !== 'type');
    }

    let cardIndex = findIndex(routeStackCards, c => c.type === type) - 1;
    if (cardIndex < 0) { return match; }
    let card = routeStackCards[cardIndex];

    if (field === 'id') {
      return card.data.id;
    } else if (field === 'type') {
      return card.data.type;
    }
    let attr = get(card, `data.attributes.${field}`);
    if (attr != null) {
      return attr;
    } else {
      return match;
    }
  });
}

module.exports = { getPath };