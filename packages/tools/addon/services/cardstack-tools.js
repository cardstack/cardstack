import { getOwner } from '@ember/application';
import { get } from '@ember/object';
import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import Service, { inject as service } from '@ember/service';
import { transitionTo } from '../private-api';
import { modelType } from '@cardstack/rendering/helpers/cs-model-type';
import injectOptional from 'ember-inject-optional';
import { defaultBranch } from '@cardstack/plugin-utils/environment';

export default Service.extend({
  overlays: service('ember-overlays'),
  resourceMetadata: service(),
  marks: alias('overlays.marks'),
  cardstackEdges: service(),

  fields: computed('marks', function() {
    return this.get('marks').filter(m => m.group === 'cardstack-fields');
  }),

  contentPages: computed('marks', function() {
    return this.get('marks').filter(m => m.group === 'cardstack-pages');
  }),

  activeContentItem: computed('contentPages', function() {
    return this.get('contentPages')[0];
  }),

  _activeItemMeta: computed('activeContentItem', function() {
    let model = this.get('activeContentItem.model')
    if (model) {
      return this.get('resourceMetadata').read(model);
    }
  }),

  branch: alias('_activeItemMeta.branch'),

  activeFields: computed('activeContentItem', 'fields', function() {
    let item = this.get('activeContentItem');
    let activeItemModel = item.model;
    let owned = ownedRelatedRecords([item.model]);
    if (item) {
      return this.get('fields').filter(f => {
        let fieldModel = f.model.content;
        if (fieldModel === activeItemModel) {
          return true;
        }
        if (owned.includes(fieldModel)) {
          return true;
        }
        return false;
      });
    } else {
      return [];
    }
  }),

  // Can tools be enabled at all? This affects whether we will offer a
  // launcher button
  available: computed('sessionService.session.isAuthenticated', function() {
    // If cardstack-session service is available, tools are only
    // available when the session is authenticated. Otherwise we
    // default to always available.
    return !this.get('sessionService') || this.get('sessionService.session.isAuthenticated');
  }),

  creatableTypes: alias('sessionService.creatableTypes'),

  sessionService: injectOptional.service('cardstack-session'),

  // Tools are active when the user has hit the launcher button and
  // revealed the toolbars.
  active: false,

  // Which tab are we showing in the toolbox?
  activePanel: 'cs-composition-panel',
  activePanelChoices: computed(function() {
    return [
      {
        id: 'cs-composition-panel',
        icon: {
          name: 'write',
          width: 13,
          height: 18
        },
      }
    ];
  }),

  // Are we viewing the current URL as a normal page in its own right,
  // or in one of its other forms (like a preview card)?
  previewFormat: 'page',
  previewFormatChoices: computed(function() {
    return [
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
    ];
  }),

  requestedEditing: false,

  // This is a placeholder until I integrate the auth system here.
  mayEditLive: computed(function() {
    let { cardstack } = getOwner(this).resolveRegistration('config:environment');
    if (cardstack && typeof cardstack.mayEditLive === 'boolean') {
      return cardstack.mayEditLive;
    } else {
      return true;
    }
  }),

  editing: computed('requestedEditing', 'branch', function() {
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

    // Register items for edges

    this.get('cardstackEdges').registerTopLevelComponent('cardstack-tools-edges');
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
      transitionTo(getOwner(this), name, args, queryParams);
    }
  },

  openField(which) {
    this.set('openedFieldId', which ? which.id : null);
  },

  highlightField(which) {
    this.set('highlightedFieldId', which ? which.id : null);
  }

});

function ownedRelatedRecords(records, out = []) {
  let [record, ...rest] = records;
  if (!record) {
    return out;
  }

  let recordClass = record.constructor;
  get(recordClass, 'relationships').forEach(([ relationshipDefinition ]) => {
    let { meta } = relationshipDefinition;
    let { owned } = meta.options;
    if (owned) {
      let relatedRecords = record.get(meta.name);
      if (meta.kind === 'hasMany') {
        relatedRecords = relatedRecords.toArray();
      }
      rest = rest.concat(relatedRecords);
      out = out.concat(relatedRecords);
    }
  });
  return ownedRelatedRecords(rest, out);
}

