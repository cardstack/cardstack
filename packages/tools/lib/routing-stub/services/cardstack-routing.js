import Ember from 'ember';

export default Ember.Service.extend({
  _warn() {
    Ember.warn("You haven't configured cardstack for routing. You should either install @cardstack/routing or implement your own cardstack-routing service.", false, { id: 'cardstack-routing-missing' })
  },
  routeFor() {
    this._warn();
  },
  routeForNew() {
    this._warn();
  },
  get defaultBranch() {
    this._warn();
  }
});
