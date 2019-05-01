import { computed } from '@ember/object';
import Service, { inject as service } from '@ember/service';
import injectOptional from 'ember-inject-optional';
import { guidFor } from '@ember/object/internals';
import { get, set } from '@ember/object';
import { sortBy, flatten } from 'lodash';

const { readOnly } = computed;

export default Service.extend({
  overlays: service('ember-overlays'),
  resourceMetadata: service(),
  cardstackEdges: service(),
  data: service('cardstack-data'),

  sessionService: injectOptional.service('cardstack-session'),

  // Tools are active when the user has hit the launcher button and
  // revealed the toolbars.
  active: false,

  // Are we viewing the current URL as a normal page in its own right,
  // or in one of its other forms (like a preview card)?
  previewFormat: 'isolated',

  // Which tab are we showing in the toolbox?
  activePanel: 'cs-composition-panel',

  requestedEditing: false,

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

    /* --  Ephemeral state -- */

    // a field is highlighted when we're drawing a (dotted) blue border around it
    this.highlightedFieldId = null;

    // a field is opened when the user is actively editing it
    this.openedFieldId = null;

    // a field is a detailed-view field when we the user selects it in the overlays
    // to see its editor options in the dynamic right-edge panel
    this.detailedViewFieldId = null;

    // Register items for edges
    this.get('cardstackEdges').registerTopLevelComponent('cs-tools');
  },

  editing: readOnly('requestedEditing'),

  creatableTypes: readOnly('sessionService.creatableTypes'),

  marks: readOnly('overlays.marks'),

  renderedFields: computed('marks', function() {
    return this.get('marks').filter(m => m.group === 'cardstack-fields');
  }),

  _renderedFieldIdentifiers: computed('renderedFields', function() {
    return this.get('renderedFields').reduce((fieldIdentifiers, fieldMark) => {
      let { grouped, name, content } = fieldMark.model;
      // This can be a case for showing a field of a relationship
      // that doesn't exist yet
      if (!content) {
        return fieldIdentifiers;
      }
      // {{cs-field group property}} can be written in the template
      // in which case `content` will be a POJO (the group representation)
      // We need to be guard against that
      if (!content.type) {
        return fieldIdentifiers;
      }
      let uid = this.data.getCardMeta(content, 'uid');
      if (grouped) {
        return fieldIdentifiers.concat(grouped.map(fieldName => `${uid}/${fieldName}`));
      } else {
        return fieldIdentifiers.concat(`${uid}/${name}`);
      }
    }, []);
  }),

  headerSectionFields: computed('activeContentItem.model', function() {
    let model = this.get('activeContentItem.model');
    if (!model) { return []; }

    let fields = [];
    model.eachAttribute((attribute, meta) => {
      if (meta.name !== 'selfLink' && get(meta, 'options.editorOptions.headerSection')) {
        let fieldInfo = meta;
        set(fieldInfo, 'id', guidFor(fieldInfo));
        set(fieldInfo, 'model', model);
        fields.push(fieldInfo);
      }
    });
    return sortBy(fields, ['options.editorOptions.sortOrder']);
  }),

  modelFields: computed('_renderedFieldIdentifiers', 'activeContentItem.model', function() {
    let renderedFieldIdentifiers = this.get('_renderedFieldIdentifiers');
    let model = this.get('activeContentItem.model');
    if (!model) { return []; }

    let modelFields = [];
    model.eachAttribute((attribute, meta) => {
      let fieldIdentifier = `${this.data.getCardMeta(model, 'uid')}/${meta.name}`;
      // Prevent rendering a field that's already explicitly rendered
      if (!renderedFieldIdentifiers.includes(fieldIdentifier) && meta.name !== 'selfLink') {
        let fieldInfo = meta;
        set(fieldInfo, 'id', guidFor(fieldInfo));
        set(fieldInfo, 'model', model);
        modelFields.push(fieldInfo);
      }
    });

    let ownedRelationshipFields = model.relatedOwnedRecords().map((record) => {
      let fields = [];
      record.eachAttribute((attribute, meta) => {
        let fieldIdentifier = `${this.data.getCardMeta(record, 'uid')}/${meta.name}`;
        // Prevent rendering a field that's already explicitly rendered
        if (!renderedFieldIdentifiers.includes(fieldIdentifier) && meta.name !== 'selfLink') {
          let fieldInfo = Object.assign({}, meta);
          fieldInfo.id = guidFor(fieldInfo);
          fieldInfo.model = record;
          fields.push(fieldInfo);
        }
      });
      return fields;
    });
    return modelFields.concat(flatten(ownedRelationshipFields));
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

  activeFields: computed('activeContentItem', 'renderedFields', function() {
    let item = this.get('activeContentItem');
    if (!item) { return []; }
    let activeItemModel = item.model;
    let owned = item.model.relatedOwnedRecords();
    if (item) {
      return this.get('renderedFields').filter(f => {
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

  activePanelChoices: computed(function() {
    return [
      {
        id: 'cs-composition-panel',
        icon: {
          name: 'edit',
          width: 20,
          height: 20
        }
      }
    ];
  }),

  previewFormatChoices: computed(function() {
    return [
      {
        id: 'isolated',
        description: 'Page',
        icon: {
          name: 'page',
          width: 18,
          height: 24
        }
      },
      {
        id: 'embedded',
        description: 'Card',
        icon: {
          name: 'tiles',
          width: 20,
          height: 24
        }
      }
    ];
  }),

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

  setEditing(isEditing) {
    this._updatePersistent('requestedEditing', isEditing);
  },

  openField(which) {
    this.set('openedFieldId', which ? which.id : null);
  },

  highlightField(which) {
    this.set('highlightedFieldId', which ? which.id : null);
  },

  detailField(which) {
    this.set('detailedViewFieldId', which ? which.id : null);
  }
});
