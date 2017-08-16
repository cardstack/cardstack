import { pluralize, singularize } from 'ember-inflector';

export function cardstackRoutes() {
  this.route('cardstack', { path: '/', resetNamespace: true }, function() {
    this.route('default-content', { path : '/:slug' });
    this.route('new-content', { path : '/:type/new' });
    this.route('content', { path : '/:type/:slug' });
  })
}

export const defaultBranch = 'master';
export const defaultContentType = 'pages';

export function routeFor(type, routingId, branch) {
  let queryParams = qpsForBranch(branch);
  type = pluralize(type);
  if (type === defaultContentType) {
    if (routingId === ' ') {
      return {
        name: 'cardstack.index',
        params: [],
        queryParams
      }
    } else {
      return {
        name: 'cardstack.default-content',
        params: [ ['routingId', routingId ] ],
        queryParams
      };
    }
  } else {
    return {
      name: 'cardstack.content',
      params: [ ['type', type], ['routingId', routingId] ],
      queryParams
    };
  }
}


function qpsForBranch(branch) {
  let queryParams = {};
  if (branch !== defaultBranch) {
    queryParams.branch = branch;
  } else {
    queryParams.branch = undefined;
  }
  return queryParams;
}

export function modelType(type, branch) {
  if (branch === defaultBranch) {
    return singularize(type);
  }
  return `${branch}--${singularize(type)}`;
}
