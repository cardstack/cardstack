const Session = require('@cardstack/plugin-utils/session');
const { get, uniq } = require('lodash');

async function getRoute(searchers, router, branch, path, applicationCard) {
  let query;
  let { route: matchedRoute,
    remainingPath,
    matchedQueryParams,
    routingCard,
    routingCardsCache,
    allowedQueryParams } = await routeThatMatchesPath(searchers, router, branch, path, applicationCard);

  if (!matchedRoute) { return; }

  routingCard = routingCard || applicationCard;

  if (matchedRoute.query) {
    query = resolveReplacementTagsFromPath(matchedRoute, path, JSON.stringify(matchedRoute.query));
    if (routingCard) {
      query = resolveRoutingCardReplacementTags(routingCard, query, routingCardsCache);
    }
  }

  // TODO perform substitution on the additionalParams and return it

  let routeStack = [ `${routingCard.data.type}/${routingCard.data.id}` ].concat(matchedRoute.routeStack.map(({contentType}) => {
    let card = routingCardsCache[`card::${contentType}`];
    if (!card) { return; }
    return `${card.data.type}/${card.data.id}`;
  }));

  if (routeStack.filter(r => !r).length) {
    // interior routing card cannot be found, consider the route unmatched
    return;
  }

  return {
    query: query && JSON.parse(query),
    matchedRoute,
    remainingPath,
    matchedQueryParams,
    allowedQueryParams,
    routingCard,
    routeStack
  };
}

function isCanonicalRoute(route) {
  if (!route.query ||
      route.path === '/' ||
      typeof route.query.filter !== 'object' ||
      Object.keys(route.query.filter).length !== 2) { return false; }

  let filter = route.query.filter;
  let typePredicate = filter.type;
  let idPredicate = filter.id;

  if (!typePredicate || !typePredicate.exact) { return false; }

  if (idPredicate && idPredicate.exact) { return true; }

  let uniqueFieldName = Object.keys(filter).find(i => i !== 'type');

  return uniqueFieldName.exact === ':friendly_id';
}

async function buildRoutingCardsCache({ searchers, branch, resolvedPath, context, applicationCard, routeStack=[] }) {
  if (!searchers || !branch) { return {}; }

  let routingCards = {};
  let typeRegex = /:(?!card:)[\w-]+\[([^\]]+)\]/g;
  let types = uniq((context.match(typeRegex) || []).map(m => m.replace(typeRegex, '$1')));

  for (let type of types) {
    if (!routingCards[type]) {
      let cardRoute;
      let stackIndex = routeStack.findIndex(r => r.contentType === type && r.query);
      let fieldRoute = routeStack[stackIndex];

      if (stackIndex === routeStack.length - 1) {
        routingCards[`card::${type}`] = applicationCard;
      } else {
        cardRoute = routeStack[stackIndex + 1];
      }

      for (let route of [cardRoute, fieldRoute].filter(i => Boolean(i))) {
        if (!route.query) { continue; }

        let query = resolvedPath ? resolveReplacementTagsFromPath(route, resolvedPath, JSON.stringify(route.query)) : JSON.stringify(route.query);
        if (query.includes(':card:')) {
          query = resolveRoutingCardReplacementTags(routingCards[`card::${route.contentType}`], query, routingCards);
        }
        let { data: cards } = await searchers.search(Session.INTERNAL_PRIVILEGED, branch, JSON.parse(query));
        if (cards.length) {
          if (route === cardRoute) {
            routingCards[`card::${type}`] = { data: cards[0] };
          } else {
            routingCards[`field::${type}`] = { data: cards[0] };
          }
        }
      }
    }
  }

  return routingCards;
}

function replaceNamespacedField(routingCard, routingCards, keyPrefix) {
  return (match, field, typeTag, type) => {
    let card = routingCards[keyPrefix + type] || routingCard;
    if (!card) { return match; }

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
  };
}

function resolveRoutingCardReplacementTags(routingCard, stringToResolve, routingCards={}) {
  if (!stringToResolve) { return stringToResolve; }

  return stringToResolve
    .replace(/:card:([\w-]+)(\[([^\]]+)\])?/g, replaceNamespacedField(routingCard, routingCards, 'card::'))
    .replace(/:([\w-]+)(\[([^\]]+)\])/g, replaceNamespacedField(routingCard, routingCards, 'field::'));
}

function resolveReplacementTagsFromPath(route, path, string) {
  let result = string;
  let dictionary = buildSubstitutionDictionary(route, path);

  for (let dynamicSegmentName of Object.keys(dictionary)) {
    result = result.replace(new RegExp(`:${dynamicSegmentName}`, 'g'), dictionary[dynamicSegmentName]);
  }
  return result;
}

async function getRoutingCardForRoute(searchers, route, branch, path, routingCardsCache={}) {
  for (let parentRoute of route.routeStack) {
    if (!parentRoute.query) { continue; }

    let query = resolveReplacementTagsFromPath(parentRoute, path, JSON.stringify(parentRoute.query));
    let routingCardType = route.routeStack.length ? route.routeStack[0].contentType : null;
    query = resolveRoutingCardReplacementTags(routingCardType && routingCardsCache[`card::${routingCardType}`], query, routingCardsCache);
    let { data:routingCards } = await searchers.search(Session.INTERNAL_PRIVILEGED, branch, JSON.parse(query));
    return routingCards.length ? { data: routingCards[0] } : null;
  }
}

function buildSubstitutionDictionary(route, path) {
  let dictionary = {};
  let type = route.contentType;
  let pathPattern = route.namespacedPath;
  let pathSegments = path.split('?')[0].split('/');
  let routeSegments = pathPattern.split('?')[0].split('/');

  // process the path part of the URL
  for (let i = 0; i < routeSegments.length; i++) {
    let routeSegment = routeSegments[i];
    if (routeSegment.charAt(0) === ':') {
      dictionary[routeSegment.replace(':', '')] = decodeURIComponent(pathSegments[i]);
    }
  }

  // process the query param part of the URL
  if (pathPattern.includes('?') && path.includes('?')) {
    let queryParams = path.split('?')[1].split('&');
    let routeQueryParams = pathPattern.split('?')[1].split('&');
    for (let routeQueryParam of routeQueryParams) {
      let nameValuePair, queryParamSplit, name;
      if ((nameValuePair = routeQueryParam.split('=')).length > 1 && (name = nameValuePair[1]).charAt(0) === ':') {
        let queryParamRegex = new RegExp(`${type}\\[${nameValuePair[0]}\\]=`);
        let queryParam = queryParams.find(i => i.match(queryParamRegex));
        if (queryParam && (queryParamSplit = queryParam.split('=')).length > 1) {
          let [, value] = queryParamSplit;
          dictionary[name.replace(':', '')] = decodeURIComponent(value);
        }
      }
    }
  }

  return dictionary;
}

function queryParamReplacement(type) {
  return (match, separator, param) =>
    `${separator === '&' ? '(\\&)?' : '\\' + separator}(${type}\\[${param}\\]=[^&]+)?`;
}

async function routeThatMatchesPath(searchers, router, branch, path, applicationCard) {
  let matchedRoute, matchedQueryParams, allowedQueryParams, routingCard, routingCardsCache;
  let remainingPath = path;

  for (let route of router) {
    let { contentType: type, path: routePath } = route;
    let pathRegex = new RegExp(`${route.path.split('?')[0].replace(/(:card)?:[^/?#&]+/g, '[^/?#&]+')}`);
    if (decodeURI(path).match(pathRegex)) {
      routingCardsCache = await buildRoutingCardsCache({
        context: route.namespacedPath,
        resolvedPath: path,
        branch,
        searchers,
        routeStack: route.routeStack,
        applicationCard,
      });
      routingCard = await getRoutingCardForRoute(searchers, route, branch, path, routingCardsCache);

      if (routePath.includes(':card')) {
        routePath = resolveRoutingCardReplacementTags(
          routingCard || applicationCard,
          route.namespacedPath,
          routingCardsCache
        );
        pathRegex = new RegExp(`${routePath.split('?')[0].replace(/(:card)?:[^/?#&]+/g, '[^/?#&]+')}`);
        if (!decodeURI(path).match(pathRegex)) {
          continue;
        }
      }

      if (!route.query && (!routingCard || routingCard.data.type !== route.contentType)) { continue; }

      matchedRoute = route;
      remainingPath = decodeURI(remainingPath).replace(pathRegex, '');

      // consume the query param part of the URL
      if (route.path.includes('?')) {
        let routeQueryParams = routePath.split('?')[1];
        allowedQueryParams = routeQueryParams.split('&').map(i => i.split('=')[0]);
        let queryParamRegex = new RegExp(`^${('?' + routeQueryParams).replace(/([?&])([^?&]+)=:[^&]+/g, queryParamReplacement(type))}`);
        let queryParamMatch = decodeURI(remainingPath).match(queryParamRegex);
        matchedQueryParams = queryParamMatch && queryParamMatch[0].replace(new RegExp(`${type}\\[([^\\]]+)\\]`, 'g'), '$1');
        if (matchedQueryParams && matchedQueryParams.slice(-1) === '&') {
          matchedQueryParams = matchedQueryParams.slice(0, -1);
        }
        remainingPath = decodeURI(remainingPath).replace(queryParamRegex, '');
      }

      if (!remainingPath.includes('?') && remainingPath.includes('&')) {
        remainingPath = remainingPath.replace('&', '?');
      }
      break;
    }
  }

  return { route: matchedRoute, remainingPath, matchedQueryParams, allowedQueryParams, routingCard, routingCardsCache };
}

module.exports = {
  getRoute,
  isCanonicalRoute,
  resolveRoutingCardReplacementTags
};