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

export function routeFor(type, slug, branch) {
  let queryParams = qpsForBranch(branch);
  type = pluralize(type);
  if (type === defaultContentType) {
    if (slug === ' ') {
      return {
        name: 'cardstack.index',
        args: [],
        queryParams
      }
    } else {
      return {
        name: 'cardstack.default-content',
        args: [slug],
        queryParams
      };
    }
  } else {
    return {
      name: 'cardstack.content',
      args: [type, slug],
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
