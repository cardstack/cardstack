const Error = require('@cardstack/plugin-utils/error');
const { uniq, get } = require('lodash');

async function getPath(plugins, schema, routingCard, card, useDefaultRouter) {
  if (!routingCard) { return; }
  if (card.data.type === 'spaces') { return; } // spaces content-type is unique in that it IS a path

  let _router = useDefaultRouter ? await getDefaultRouter(plugins, routingCard) :
                                   await getRouter(plugins, schema, routingCard);
  if (!_router || !card) { return; }

  let path = getCanonicalPath(_router, card.data);
  if (path) {
    return encodeURI(path);
  }
}

async function getRouter(plugins, schema, cardContext) {
  let type = get(cardContext, 'data.type');
  let routerName = schema.types.get(type).routerName;
  let router;
  if (!routerName) {
    let feature = plugins.lookupFeatureFactory('routers', schema.plugins.rootPlugin.id);
    if (feature && typeof feature.class === 'function') {
      router = feature.class;
    } else {
      return;
    }
  }

  router = router || (plugins.lookupFeatureFactoryAndAssert('routers', routerName)).class;

  if (typeof router !== 'function') {
    throw new Error(`The router for content type '${type}' is not a function.`);
  }

  return router(cardContext);
}

async function getDefaultRouter(plugins, cardContext) {
  let { class: router } = plugins.lookupFeatureFactoryAndAssert('routers', '@cardstack/routing');
  return router(cardContext);
}

function findStaticMappingRoute(router) {
  for (let route of router) {
    let { path, query } = route;
    if (!path || !query) { continue; }

    // TODO need to refactor this after our search filtering defaults to exact match
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

function findFriendlyIdBasedRoute(router, card) {
  for (let route of router) {
    let { path, query } = route;
    if (!path || !query) { continue; }

    let filter = query.filter;
    if (!filter) { continue; }

    if (get(filter, 'type.exact') !== card.type || Object.keys(filter).length !== 2) { continue; }
    let uniqueFieldName = Object.keys(filter).find(i => i !== 'type');

    // TODO need to refactor this after our search filtering defaults to exact match
    if (get(filter, `${uniqueFieldName}.exact`) === ':friendly_id' &&
        path.includes(':friendly_id')) {
      return route;
    }
  }
}

function findVanityPathRoute(router, card) {
  for (let route of router) {
    let { path, query } = route;
    if (!path || !query) { continue; }

    if (!path.includes(':') &&
        // TODO need to refactor this after our search filtering defaults to exact match
        get(query, 'filter.type.exact') === card.type &&
        get(query, 'filter.id.exact') === card.id) {
      return route;
    }
  }
}

function resolvePathRelacementTags(route, card) {
  if (!get(route, 'query.filter') || !route.path) { return; }

  let filter = route.query.filter;
  let typeReplacement = get(filter, 'type.exact');
  typeReplacement = typeReplacement.charAt(0) === ':' ? typeReplacement : null;
  let uniqueFieldName = Object.keys(filter).find(i => i !== 'type');

  let path = route.path;
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

function getCanonicalPath(router, card) {
  let route = findVanityPathRoute(router, card);
  if (route) {
    return route.path;
  }

  route = findFriendlyIdBasedRoute(router, card);
  if (route) {
    return resolvePathRelacementTags(route, card);
  }

  route = findStaticMappingRoute(router);
  if (route) {
    return resolvePathRelacementTags(route, card);
  }
}

function getRoute(router, path, type) {
  let { route: matchedRoute,
    remainingPath,
    matchedQueryParams,
    allowedQueryParams } = routeThatMatchesPath(router, path, type);

  if (!matchedRoute) { return; }

  let dictionary = buildSubstitutionDictionary(matchedRoute, path, type);
  let query;
  if (matchedRoute.query) {
    query = JSON.stringify(matchedRoute.query);
    for (let dynamicSegmentName of Object.keys(dictionary)) {
      query = query.replace(new RegExp(`:${dynamicSegmentName}`, 'g'), dictionary[dynamicSegmentName]);
    }
  }

  return {
    query: query && JSON.parse(query),
    remainingPath,
    matchedQueryParams,
    allowedQueryParams,
    path: matchedRoute.path,
  };
}

function buildSubstitutionDictionary(route, path, type) {
  let dictionary = {};
  let pathSegments = path.split('?')[0].split('/');
  let routeSegments = route.path.split('?')[0].split('/');

  // process the path part of the URL
  for (let i = 0; i < routeSegments.length; i++) {
    let routeSegment = routeSegments[i];
    if (routeSegment.charAt(0) === ':') {
      dictionary[routeSegment.replace(':', '')] = decodeURIComponent(pathSegments[i]);
    }
  }

  // process the query param part of the URL using query params that are namespaced with the content type of the router that consumes them
  if (route.path.includes('?') && path.includes('?')) {
    let queryParams = path.split('?')[1].split('&');
    let routeQueryParams = route.path.split('?')[1].split('&');
    for (let routeQueryParam of routeQueryParams) {
      let nameValuePair, queryParamSplit, name;
      if ((nameValuePair = routeQueryParam.split('=')).length > 1 && (name = nameValuePair[1]).charAt(0) === ':') {
        let queryParamRegex = new RegExp(`${type}\\[${nameValuePair[0]}\\]=`);
        let queryParam = queryParams.find(i => i.match(queryParamRegex));
        if ((queryParamSplit = queryParam.split('=')).length > 1) {
          let [, value] = queryParamSplit;
          dictionary[name.replace(':', '')] = decodeURIComponent(value);
        }
      }
    }
  }

  return dictionary;
}

function routeThatMatchesPath(router, path, type) {
  let matchedRoute;
  let matchedQueryParams;
  let allowedQueryParams;
  let remainingPath = path;

  for (let route of router) {
    if (!route.path) {
      throw new Error(`The router for content type '${type}' has a route that is missing a path.`);
    }
    let routeRegex = new RegExp(`^${route.path.replace(/([?&])([^?&]+)=:[^&]+/g,
      (match, separator, param) => `\\${separator}${type}\\[${param}\\]=[^&]+`)
      .replace(/:[^/?#&]+/g, '[^/?#&]+')}`);

    if (decodeURI(path).match(routeRegex)) {
      matchedRoute = route;

      // consume the path part of the URL
      let pathRegex = new RegExp(`${route.path.split('?')[0].replace(/:[^/?#&]+/g, '[^/?#&]+')}`);
      remainingPath = decodeURI(remainingPath).replace(pathRegex, '');

      // consume the query param part of the URL
      if (route.path.includes('?')) {
        let routeQueryParams = route.path.split('?')[1];
        allowedQueryParams = routeQueryParams.split('&').map(i => i.split('=')[0]);
        let queryParamRegex = new RegExp(`^${('?' + routeQueryParams).replace(/([?&])([^?&]+)=:[^&]+/g,
          (match, separator, param) => `\\${separator}${type}\\[${param}\\]=[^&]+`)}`);
        let queryParamMatch = decodeURI(remainingPath).match(queryParamRegex);
        matchedQueryParams = queryParamMatch && queryParamMatch[0].replace(new RegExp(`${type}\\[([^\\]]+)\\]`, 'g'), '$1');
        remainingPath = decodeURI(remainingPath).replace(queryParamRegex, '');
      }

      if (!remainingPath.includes('?') && remainingPath.includes('&')) {
        remainingPath = remainingPath.replace('&', '?');
      }
      break;
    }
  }

  return { route: matchedRoute, remainingPath, matchedQueryParams, allowedQueryParams };
}

function getAllowedQueryParamsForRouter(router) {
  if (!Array.isArray(router)) { return; }

  let queryParams = [];
  for (let route of router) {
    if (!route.path || !route.path.includes('?')) { continue; }

    let routeQueryParams = route.path.split('?')[1];
    queryParams = queryParams.concat(routeQueryParams.split('&').map(i => i.split('=')[0]));
  }

  return uniq(queryParams);
}

module.exports = {
  getPath,
  getRoute,
  getRouter,
  getDefaultRouter,
  getAllowedQueryParamsForRouter
};