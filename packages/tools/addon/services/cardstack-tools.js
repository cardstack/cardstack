import Ember from 'ember';

export default Ember.Service.extend({
  overlays: Ember.inject.service('ember-overlays'),
  marks: Ember.computed.alias('overlays.marks'),

  fields: Ember.computed('marks', function() {
    return this.get('marks').filter(m => m.group === 'cardstack-fields');
  }),

  contentItems: Ember.computed('marks', function() {
    return this.get('marks').filter(m => m.group === 'cardstack-content');
  }),

  activeContentItem: Ember.computed('contentItems', function() {
    return this.get('contentItems')[0];
  }),

  activeFields: Ember.computed('activeContentItem', 'fields', function() {
    let item = this.get('activeContentItem');
    if (item) {
      return this.get('fields').filter(f => f.model.content === item.model);
    } else {
      return [];
    }
  }),

  // Can tools be enabled at all? This affects whether we will offer a
  // launcher button
  available: true,

  // Tools are active when the user has hit the launcher button and
  // revealed the toolbars.
  active: false,

  // Which tab are we showing in the toolbox?
  activePanel: 'cs-composition-panel',
  activePanelChoices: [
    {
      id: 'cs-composition-panel',
      icon: {
        name: 'write',
        width: 13,
        height: 18
      },
    },
    {
      id: 'cardstack-library',
      icon: {
        name: 'archive',
        width: 22,
        height: 24
      }
    }
  ],

  // Are we viewing the current URL as a normal page in its own right,
  // or in one of its other forms (like a preview card)?
  previewFormat: 'page',
  previewFormatChoices: [
    {
      id: 'page',
      description: 'Page',
      icon: {
        name: 'page',
        width: 18,
        height: 24
      }
    },
    {
      id: 'cards',
      description: 'Card',
      icon: {
        name: 'tiles',
        width: 20,
        height: 24
      }
    }
  ],

  editing: false,

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


    /* --  Ephermal state -- */

    // a field is highlighted when we're drawing a blue border around it
    this.highlightedFieldId = null;

    // a field is opened when the user is actively editing it
    this.openedFieldId = null;
  },

  _updatePersistent(key, value) {
    this.persistentState[key] = value;
    localStorage.setItem('cardstack-tools', JSON.stringify(this.persistentState));
    this.set(key, value);
  },

  setPreviewFormat(mode) {
    this._updatePersistent('previewFormat', mode);
  },

  setActive(isActive) {
    this._updatePersistent('active', isActive);
  },

  setActivePanel(which) {
    this._updatePersistent('activePanel', which);
  },

  setEditing(which) {
    this._updatePersistent('editing', which);
  },

  openField(which) {
    this.set('openedFieldId', which ? which.id : null);
  },

  highlightField(which) {
    this.set('highlightedFieldId', which ? which.id : null);
  }

});
