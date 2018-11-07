import { inject as service } from '@ember/service';
import Helper from '@ember/component/helper';
import { get } from '@ember/object';
import { defaultBranch } from '@cardstack/plugin-utils/environment';
import { hrefTo } from 'ember-href-to/helpers/href-to';

export function urlForModel(context, model, { branch } = {}) {
  if (model) {
    let path = get(model, 'selfLink');
    if (!path) { return; }

    if (path.charAt(0) === '/') {
      path = path.replace('/', ''); // looks like ember router prepends an extra '/' to the path
    }
    return urlForParams(context, path, { branch });
  }
}

export function urlForParams(context, path, { branch } = {}) {
  if (!path) { return; }

  if (path.charAt(0) === '/') {
    path = path.replace('/', ''); // looks like ember router prepends an extra '/' to the path
  }
  path = encodeURI(path);
  let { name, params, queryParams } = get(context, 'cardstackRouting').routeFor(path, branch || defaultBranch);
  return hrefTo(context, name, ...params.map(p => p[1]), { isQueryParams: true, values: queryParams });
}

export default Helper.extend({
  cardstackRouting: service(),
  compute(args, hash) {
    if (args.length === 1) {
      let [arg] = args;
      if (typeof arg === 'string') {
        return urlForParams(this, arg, hash);
      } else {
        return urlForModel(this, arg, hash);
      }
    } else {
      throw new Error(`the cardstack-url helper expects one argument which can be either the model to our to or the path of the model to route to.`);
    }
  }
});
