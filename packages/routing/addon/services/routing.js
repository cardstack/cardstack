import Ember from 'ember';
import { pluralize, singularize } from 'ember-inflector';
import { defaultBranch } from '@cardstack/plugin-utils/environment';

export default Ember.Service.extend({
  defaultContentType: 'pages',

  routeFor(type, routingId, branch) {
    let queryParams = this._qpsForBranch(branch);
    type = pluralize(type);
    if (type === this.defaultContentType) {
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
