import Ember from 'ember';
import { transitionTo } from '../private-api';
import { modelType } from '@cardstack/rendering/helpers/cs-model-type';
import injectOptional from 'ember-inject-optional';
import { defaultBranch } from '@cardstack/plugin-utils/environment';

export default Ember.Service.extend({
  overlays: Ember.inject.service('ember-overlays'),
  resourceMetadata: Ember.inject.service(),
  marks: Ember.computed.alias('overlays.marks'),

  fields: Ember.computed('marks', function() {
    return this.get('marks').filter(m => m.group === 'cardstack-fields');
  }),

  contentPages: Ember.computed('marks', function() {
    return this.get('marks').filter(m => m.group === 'cardstack-pages');
  }),

  activeContentItem: Ember.computed('contentPages', function() {
    return this.get('contentPages')[0];
  }),

  _activeItemMeta: Ember.computed('activeContentItem', function() {
    let model = this.get('activeContentItem.model')
    if (model) {
      return this.get('resourceMetadata').read(model);
    }
  }),

  branch: Ember.computed.alias('_activeItemMeta.branch'),

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
  available: Ember.computed('sessionService.session.isAuthenticated', function() {
    // If cardstack-session service is available, tools are only
    // available when the session is authenticated. Otherwise we
    // default to always available.
    return !this.get('sessionService') || this.get('sessionService.session.isAuthenticated');
  }),

  sessionService: injectOptional.service('cardstack-session'),

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

  requestedEditing: false,

  // This is a placeholder until I integrate the auth system here.
  mayEditLive: Ember.computed(function() {
    let { cardstack } = Ember.getOwner(this).resolveRegistration('config:environment');
    if (cardstack && typeof cardstack.mayEditLive === 'boolean') {
      return cardstack.mayEditLive;
    } else {
      return true;
    }
  }),

  editing: Ember.computed('requestedEditing', 'branch', function() {
    return this.get('requestedEditing') &&
      (this.get('mayEditLive') ||
       this.get('branch') !== defaultBranch);
  }),

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


    /* --  Ephemermal state -- */

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
    if (which === 'cs-create-menu') {
      if (!this.get('mayEditLive') && this.get('branch') === defaultBranch) {
        this.setBranch('draft');
      }
    }
  },

  setEditing(which) {
    this._updatePersistent('requestedEditing', which);
    if (!this.get('mayEditLive') && this.get('branch') === defaultBranch) {
      this.setBranch('draft');
    }
  },

  setBranch(which) {
    let model = this.get('activeContentItem.model')
    if (model && model.get('slug')) {
      let {
        name,
        args,
        queryParams
      } = this.get('cardstackRouting').routeFor(modelType(model), model.get('slug'), which);
      transitionTo(Ember.getOwner(this), name, args, queryParams);
    }
  },

  openField(which) {
    this.set('openedFieldId', which ? which.id : null);
  },

  highlightField(which) {
    this.set('highlightedFieldId', which ? which.id : null);
  }

});
