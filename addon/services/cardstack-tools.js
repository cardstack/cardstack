import Ember from 'ember';

export default Ember.Service.extend({
  // Can tools be enabled at all? This affects whether we will offer a
  // launcher button
  available: true,

  // Tools are active when the user has hit the launcher button and
  // revealed the toolbars.
  active: false,

  // Which component are we showing in the sidebar area?
  activePanel: 'cardstack-toolbox',

  // Are we viewing the current URL as a normal page in its own right,
  // or in one of its other forms (like a preview card)?
  viewMode: 'page',

  init() {
    this._super();
    let priorState;
    try {
      let item = localStorage.getItem('cardstack-tools');
      if (item) {
        priorState = JSON.parse(item);
        for (let key in priorState) {
          this.set(key, priorState[key]);
        }
      }
    } catch (err) {
      // Ignored
    }
    this.persistentState = priorState || {};
  },

  _updatePersistent(key, value) {
    this.persistentState[key] = value;
    localStorage.setItem('cardstack-tools', JSON.stringify(this.persistentState));
    this.set(key, value);
  },

  setViewMode(mode) {
    this._updatePersistent('viewMode', mode);
  },

  setActive(isActive) {
    this._updatePersistent('active', isActive);
  }
});
