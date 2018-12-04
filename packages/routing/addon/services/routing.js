import Service from '@ember/service';
import { pluralize, singularize } from 'ember-inflector';
import { defaultBranch } from '@cardstack/plugin-utils/environment';

export default Service.extend({
  routeFor(path, branch) {
    let queryParams = this._qpsForBranch(branch);

    return {
      name: 'cardstack.content',
      params: [ ['path', path] ],
      queryParams
    };
  },

  routeForNew(type, branch) {
    let queryParams = this._qpsForBranch(branch);
    type = pluralize(type);
    return {
      name: 'cardstack.new-content',
      params: [ ['type', type] ],
      queryParams
    }
  },

  _qpsForBranch(branch) {
    let queryParams = {};
    if (branch !== defaultBranch) {
      queryParams.branch = branch;
    } else {
      queryParams.branch = undefined;
    }
    return queryParams;
  },

  modelType(type, branch) {
    if (branch === defaultBranch) {
      return singularize(type);
    }
    return `${branch}--${singularize(type)}`;
  }

});
