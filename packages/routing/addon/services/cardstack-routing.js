/*
  This service exposes the minimum API that an app not
  using @cardstack/routing needs to implement on its own to
  make @cardstack/tools work. That is, you would implement a service
  in your app named 'cardstack-routing' with methods like routeFor,
  etc.
*/

import Ember from 'ember';

export default Ember.Service.extend({
  // === Begin Required API ===

  routeFor(type, slug, branch) {
    let queryParams = this._qpsForBranch(branch);
    if (type === this.get('config.defaultContentType')) {
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
  },

  routeForNew(type, branch) {
    let queryParams = this._qpsForBranch(branch);
    return {
      name: 'cardstack.new-content',
      args: [type],
      queryParams
    };
  },

  defaultBranch: Ember.computed.alias('config.defaultBranch'),

  // === End Required API ===
  //
  // This after this point are used by the routes
  // within @cardstack/routing, but they don't constitute public API
  // that you need to implement if you're implementing your own
  // replacemnt for @cardstack/routing.

  config: Ember.computed(function() {
    let config = Ember.getOwner(this).resolveRegistration('config:environment');
    return config.cardstack;
  }),

  defaultContentType: Ember.computed.alias('config.defaultContentType'),

  _qpsForBranch(branch) {
    let queryParams = {};
    if (branch !== this.get('config.defaultBranch')) {
      queryParams.branch = branch;
    } else {
      queryParams.branch = undefined;
    }
    return queryParams;
  }

});
